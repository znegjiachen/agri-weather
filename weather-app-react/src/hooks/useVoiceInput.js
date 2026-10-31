import { useCallback, useEffect, useRef, useState } from 'react';
import { agent as agentApi } from '../api';

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

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

  const mediaRef = useRef(null);
  const recognitionRef = useRef(null);
  const callbacksRef = useRef({ onText, onError });
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

  useEffect(() => () => {
    cancelledRef.current = true;
    const media = mediaRef.current;
    if (media) {
      try {
        if (media.recorder.state !== 'inactive') media.recorder.stop();
      } catch { /* ignore */ }
      media.stream?.getTracks().forEach((track) => track.stop());
    }
    try { recognitionRef.current?.abort?.(); } catch { /* ignore */ }
  }, []);

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
        if (cancelledRef.current) return;
        setRecording(false);
        if (chunks.length === 0) return;

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

      recorder.start();
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
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          text += event.results[i][0].transcript;
        }
        if (text.trim()) callbacksRef.current.onText?.(text.trim());
      };
      recognition.onerror = (event) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          callbacksRef.current.onError?.(`语音识别失败：${event.error}`);
        }
        setRecording(false);
      };
      recognition.onend = () => setRecording(false);
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
      callbacksRef.current.onError?.('未配置语音识别服务，且当前浏览器不支持语音输入');
    }
  };

  return {
    recording,
    processing,
    toggle,
    mode,
    supported: !!browserRecognition || (!!asrConfigured && recorderSupported),
  };
}