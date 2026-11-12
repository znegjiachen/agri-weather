import { useCallback, useEffect, useRef, useState } from 'react';
import { agent as agentApi } from '../api';

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// 音量峰值低于该值视为没采到人声；正常说话 RMS 一般在 0.01 以上
const SILENCE_RMS = 0.003;

const BROWSER_ASR_ERRORS = {
  'not-allowed': '麦克风权限被拒绝，请在浏览器地址栏允许访问麦克风',
  'service-not-allowed': '浏览器语音服务被禁用，请改用文字输入',
  network: '浏览器语音识别需要访问在线语音服务，当前网络不可用；请改用文字输入，或配置后端 ASR 服务',
  'audio-capture': '没有检测到可用麦克风，请检查设备',
  'no-speech': '没有识别到语音内容，请再说一次',
};

/**
 * 语音输入：
 * - 后端配置了 ASR：录音后用 MediaRecorder 上传，走 Whisper/兼容服务；
 * - 没有配置：回退到浏览器 SpeechRecognition（Chrome/Edge 等）；
 * - 两者都不可用时给出明确提示。
 */
export function useVoiceInput({ asrConfigured, onText, onError }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState(null);
  const [level, setLevel] = useState(0);

  const mediaRef = useRef(null);
  const recognitionRef = useRef(null);
  const browserTextRef = useRef('');
  const callbacksRef = useRef({ onText, onError });
  const startedAtRef = useRef(0);
  const levelPeakRef = useRef(0);
  const meterAvailableRef = useRef(false);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(0);
  // 离开页面时丢弃正在录的音，避免卸载后还在上传
  const cancelledRef = useRef(false);
  const browserRecognition = getSpeechRecognition();
  const recorderSupported = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && !!window.MediaRecorder;

  useEffect(() => {
    callbacksRef.current = { onText, onError };
  }, [onText, onError]);

  // 录音期间用 AnalyserNode 测音量：既做实时反馈，也用来识别「麦克风其实没收到声音」
  const stopMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx) {
      try { ctx.close(); } catch { /* ignore */ }
    }
    setLevel(0);
  }, []);

  const startMeter = useCallback((stream) => {
    levelPeakRef.current = 0;
    meterAvailableRef.current = false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      let lastPaint = 0;
      audioCtxRef.current = ctx;
      meterAvailableRef.current = true;

      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / buffer.length);
        if (rms > levelPeakRef.current) levelPeakRef.current = rms;
        const now = performance.now();
        if (now - lastPaint > 100) {
          lastPaint = now;
          setLevel(Math.min(1, rms * 6));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // 拿不到 AudioContext 时不做静音判断，交给后端 ASR
      meterAvailableRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    const media = mediaRef.current;
    if (media?.recorder && media.recorder.state !== 'inactive') {
      media.recorder.stop();
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
    }
  }, []);

  useEffect(() => {
    // StrictMode 开发环境会执行一次挂载→卸载→再挂载，
    // 这里必须重置取消标记，否则录音结束后永远不上传
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      const media = mediaRef.current;
      if (media) {
        try {
          if (media.recorder.state !== 'inactive') media.recorder.stop();
        } catch { /* ignore */ }
        media.stream?.getTracks().forEach((track) => track.stop());
      }
      stopMeter();
      try { recognitionRef.current?.abort?.(); } catch { /* ignore */ }
    };
  }, [stopMeter]);

  const startBackend = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRef.current = null;
        stopMeter();
        if (cancelledRef.current) return;
        setRecording(false);
        const durationMs = Date.now() - startedAtRef.current;
        if (durationMs < 800) {
          callbacksRef.current.onError?.('录音时间太短，请说完再点结束');
          return;
        }
        const peak = levelPeakRef.current;
        if (meterAvailableRef.current && peak < SILENCE_RMS) {
          callbacksRef.current.onError?.(
            `麦克风没有采集到声音（音量峰值 ${peak.toFixed(4)}）。`
            + '请检查系统输入设备是否选对、是否静音，或换一个麦克风后重试。',
          );
          return;
        }
        if (chunks.length === 0) {
          callbacksRef.current.onError?.('没有录到声音，请检查麦克风是否被静音');
          return;
        }

        setProcessing(true);
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const data = await agentApi.transcribe(blob);
          const text = (data?.text || '').trim();
          if (text) callbacksRef.current.onText?.(text);
          else callbacksRef.current.onError?.('没有识别到语音内容，请再说一次');
        } catch (e) {
          callbacksRef.current.onError?.(e.message || '语音识别失败');
        } finally {
          setProcessing(false);
        }
      };

      // 每 250ms 落一块，短录音也能拿到数据；避免快速停止时 chunks 为空
      recorder.start(250);
      startedAtRef.current = Date.now();
      startMeter(stream);
      mediaRef.current = { stream, recorder };
      setMode('backend');
      setRecording(true);
    } catch (e) {
      callbacksRef.current.onError?.(`无法使用麦克风：${e.message || '请检查浏览器权限'}`);
    }
  };

  const startBrowser = () => {
    if (!browserRecognition) return;
    try {
      const recognition = new browserRecognition();
      recognition.lang = 'zh-CN';
      // 点击开始说话，再次点击结束；continuous 避免停顿后自动截断
      recognition.interimResults = true;
      recognition.continuous = true;
      let finalText = '';
      browserTextRef.current = '';
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interim += result[0].transcript;
        }
        browserTextRef.current = `${finalText}${interim}`.trim();
      };
      recognition.onerror = (event) => {
        if (event.error === 'aborted') return;
        // 已经有识别内容时让 onend 正常提交，不再报无语音
        if (event.error === 'no-speech' && browserTextRef.current) {
          setRecording(false);
          return;
        }
        callbacksRef.current.onError?.(
          BROWSER_ASR_ERRORS[event.error] || `语音识别失败：${event.error}`,
        );
        setRecording(false);
      };
      recognition.onend = () => {
        const text = browserTextRef.current.trim();
        browserTextRef.current = '';
        setRecording(false);
        if (text) callbacksRef.current.onText?.(text);
      };
      recognitionRef.current = recognition;
      setMode('browser');
      setRecording(true);
      recognition.start();
    } catch {
      setRecording(false);
      callbacksRef.current.onError?.('浏览器语音识别启动失败，请改用文字输入');
    }
  };

  const toggle = () => {
    if (recording) {
      stop();
      return;
    }
    if (processing) return;
    if (asrConfigured && recorderSupported) {
      startBackend();
    } else if (browserRecognition) {
      startBrowser();
    } else if (asrConfigured) {
      callbacksRef.current.onError?.('当前浏览器不支持录音，请更换浏览器');
    } else {
      callbacksRef.current.onError?.('语音输入不可用：未配置后端 ASR，且当前浏览器不支持语音识别');
    }
  };

  return {
    recording,
    processing,
    toggle,
    mode,
    level,
    supported: !!browserRecognition || (!!asrConfigured && recorderSupported),
  };
}