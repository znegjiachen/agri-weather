import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { community } from '../api';

const MAX_TEXT = 2000;
const MAX_IMAGES = 9;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'link', 'image'],
  ['clean'],
];

/**
 * 社区富文本编辑器。
 *
 * 不引入 React 封装库：Quill 自己管理 contenteditable 的 DOM，
 * 走 wrapper 反而更容易在 StrictMode 双挂载时丢实例。
 *
 * 输出是 HTML；服务端还会再净化一遍，前端这层只负责体验。
 */
const RichTextEditor = forwardRef(function RichTextEditor(
  { placeholder = '说点什么…', onChange, onUploadingChange, onError },
  ref,
) {
  const hostRef = useRef(null);
  const fileInputRef = useRef(null);
  const quillRef = useRef(null);
  const uploadingRef = useRef(0);
  const tokenSeq = useRef(0);
  const [textLength, setTextLength] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);

  const onChangeRef = useRef(onChange);
  const onUploadingRef = useRef(onUploadingChange);
  const onErrorRef = useRef(onError);
  onChangeRef.current = onChange;
  onUploadingRef.current = onUploadingChange;
  onErrorRef.current = onError;

  const emitChange = useCallback(() => {
    const quill = quillRef.current;
    if (!quill) return;
    // 图片在 getText() 里是一个 U+FFFC 占位符，不算进字数
    const text = quill.getText().replace(/￼/g, '').trim();
    const imageCount = quill.root.querySelectorAll('img').length;
    setTextLength(text.length);
    onChangeRef.current?.({ html: quill.root.innerHTML, textLength: text.length, imageCount });
  }, []);

  const setUploading = useCallback((delta) => {
    uploadingRef.current = Math.max(0, uploadingRef.current + delta);
    setUploadingCount(uploadingRef.current);
    onUploadingRef.current?.(uploadingRef.current > 0);
  }, []);

  const replaceToken = useCallback((token, url) => {
    const quill = quillRef.current;
    if (!quill) return;
    const index = quill.getText().indexOf(token);
    if (index < 0) return; // 用户在上传期间删掉了占位符
    quill.deleteText(index, token.length, 'user');
    if (url) {
      quill.insertEmbed(index, 'image', url, 'user');
      quill.setSelection(index + 1, 0, 'user');
    }
  }, []);

  const uploadOne = useCallback(async (file) => {
    const quill = quillRef.current;
    if (!quill) return;

    const range = quill.getSelection(true) ?? { index: Math.max(0, quill.getLength() - 1) };
    const token = `[[图片上传中:${++tokenSeq.current}]]`;
    quill.insertText(range.index, token, 'user');
    quill.setSelection(range.index + token.length, 0, 'user');

    setUploading(1);
    try {
      const { url } = await community.uploadImage(file);
      replaceToken(token, url);
    } catch (e) {
      replaceToken(token, null);
      onErrorRef.current?.(e.message);
    } finally {
      setUploading(-1);
      emitChange();
    }
  }, [emitChange, replaceToken, setUploading]);

  const uploadFiles = useCallback(async (files) => {
    const quill = quillRef.current;
    if (!quill) return;

    const picked = Array.from(files || []);
    if (picked.length === 0) return; // 用户取消选择，不要弹错误

    const list = picked.filter(
      (f) => f && (f.type?.startsWith('image/') || /\.(jpe?g|png)$/i.test(f.name || '')),
    );
    if (list.length === 0) {
      onErrorRef.current?.('仅支持 JPG/PNG 图片');
      return;
    }

    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        onErrorRef.current?.('图片不能超过 5MB');
        continue;
      }
      const count = quill.root.querySelectorAll('img').length + uploadingRef.current;
      if (count >= MAX_IMAGES) {
        onErrorRef.current?.(`每帖最多 ${MAX_IMAGES} 张图片`);
        break;
      }
      await uploadOne(file);
    }
  }, [uploadOne]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const editorEl = document.createElement('div');
    host.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: {
          container: TOOLBAR,
          handlers: {
            image: () => fileInputRef.current?.click(),
          },
        },
      },
    });
    quillRef.current = quill;

    const handleTextChange = () => emitChange();
    quill.on('text-change', handleTextChange);

    const handlePaste = (event) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (files.some((f) => f.type?.startsWith('image/'))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        uploadFiles(files);
      }
    };
    const handleDrop = (event) => {
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.some((f) => f.type?.startsWith('image/'))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        uploadFiles(files);
      }
    };
    const handleDragOver = (event) => {
      if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
    };

    quill.root.addEventListener('paste', handlePaste, true);
    quill.root.addEventListener('drop', handleDrop, true);
    quill.root.addEventListener('dragover', handleDragOver, true);

    emitChange();

    return () => {
      quill.off('text-change', handleTextChange);
      quill.root.removeEventListener('paste', handlePaste, true);
      quill.root.removeEventListener('drop', handleDrop, true);
      quill.root.removeEventListener('dragover', handleDragOver, true);
      quillRef.current = null;
      host.innerHTML = '';
    };
  }, [emitChange, placeholder, uploadFiles]);

  useImperativeHandle(ref, () => ({
    getHtml: () => quillRef.current?.root.innerHTML || '',
    getText: () => quillRef.current?.getText().replace(/￼/g, '').trim() || '',
    getImageCount: () => quillRef.current?.root.querySelectorAll('img').length || 0,
    isEmpty: () => {
      const quill = quillRef.current;
      if (!quill) return true;
      const text = quill.getText().replace(/￼/g, '').trim();
      return text.length === 0 && quill.root.querySelectorAll('img').length === 0;
    },
    clear: () => {
      quillRef.current?.setText('');
      setTextLength(0);
      emitChange();
    },
    focus: () => quillRef.current?.focus(),
    isUploading: () => uploadingRef.current > 0,
  }), [emitChange]);

  const handleFilePicked = (event) => {
    // 必须先拷成数组：value='' 会把 live 的 FileList 一起清空，
    // 直接把 files 引用传下去会变成空列表（表现为「选了图却提示仅支持 JPG/PNG」）
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    uploadFiles(files);
  };

  return (
    <div className="community-editor">
      <div ref={hostRef} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        hidden
        onChange={handleFilePicked}
      />
      <div className="community-editor-foot">
        <span className={`community-editor-count ${textLength > MAX_TEXT ? 'over' : ''}`}>
          {textLength}/{MAX_TEXT}
        </span>
        {uploadingCount > 0 && <span className="community-editor-uploading">图片上传中…</span>}
      </div>
    </div>
  );
});

export default RichTextEditor;