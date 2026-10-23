import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { community } from '../api';
import { useAuth } from '../context/AuthContext';
import RichTextEditor from '../components/RichTextEditor';

const CATEGORY_LABEL = { CHAT: '闲聊', TECH: '技术', ALERT: '预警' };
const MAX_TEXT = 2000;

function plainText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function firstImage(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return doc.querySelector('img')?.getAttribute('src') || null;
}

/** 发帖接口返回完整帖子；转成列表项，避免为了刷新再拉一次接口 */
function toSummary(post) {
  const text = plainText(post.content);
  return {
    id: post.id,
    title: post.title,
    excerpt: text.length > 140 ? `${text.slice(0, 140)}…` : text,
    coverImage: post.contentFormat === 'HTML' ? firstImage(post.content) : null,
    contentFormat: post.contentFormat,
    category: post.category,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    liked: post.liked,
    author: post.author,
    authorId: post.authorId,
    createdAt: post.createdAt,
  };
}

export default function CommunityPage() {
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CHAT');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorState, setEditorState] = useState({ textLength: 0, imageCount: 0 });

  const editorRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await community.list(null, 20));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const editorEmpty = editorState.textLength === 0 && editorState.imageCount === 0;

  const submit = async () => {
    if (editorEmpty || submitting || uploading) return;

    const html = editorRef.current?.getHtml() || '';
    setSubmitting(true);
    try {
      const created = await community.create({
        title: title.trim(),
        content: html,
        contentFormat: 'HTML',
        category,
      });
      setPosts((prev) => [toSummary(created), ...prev]);
      setTitle('');
      setCategory('CHAT');
      setEditorState({ textLength: 0, imageCount: 0 });
      editorRef.current?.clear();
      setComposing(false);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  /** 乐观更新：先改 UI，失败再回滚。列表项没有正文，只能合并计数 */
  const toggleLike = async (post) => {
    setPosts((prev) => prev.map((p) => (p.id === post.id
      ? { ...p, liked: !p.liked, likeCount: p.likeCount + (p.liked ? -1 : 1) }
      : p)));

    try {
      const updated = post.liked
        ? await community.unlike(post.id)
        : await community.like(post.id);
      setPosts((prev) => prev.map((p) => (p.id === updated.id
        ? { ...p, liked: updated.liked, likeCount: updated.likeCount }
        : p)));
    } catch (e) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      setError(e.message);
    }
  };

  return (
    <div className="community-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">💬 农友社区</h2>
          <p className="page-subtitle">和周边的农户交流种植经验</p>
        </div>
        <button
          className="btn-primary community-compose-btn"
          onClick={() => {
            setComposing((v) => !v);
            setError('');
          }}
        >
          {composing ? '取消' : '✏️ 发帖'}
        </button>
      </div>

      {error && <div className="agent-error">{error}</div>}

      {composing && (
        <div className="glass community-compose">
          <input
            className="community-input"
            placeholder="标题（可选）"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
          />

          <RichTextEditor
            ref={editorRef}
            onChange={setEditorState}
            onUploadingChange={setUploading}
            onError={setError}
          />

          <div className="community-compose-foot">
            <div className="community-cats">
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  className={`community-cat ${category === key ? 'active' : ''}`}
                  onClick={() => setCategory(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={editorEmpty || uploading || submitting || editorState.textLength > MAX_TEXT}
            >
              {submitting ? '发布中…' : uploading ? '图片上传中…' : '发布'}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="empty-text">加载中…</p>}

      {!loading && posts.length === 0 && (
        <div className="glass section-card">
          <p className="empty-text">还没有帖子，来发第一条吧</p>
        </div>
      )}

      <div className="community-grid">
        {posts.map((p) => (
          <article key={p.id} className="glass community-note">
            <Link to={`/community/${p.id}`} className="community-note-link">
              <div className={`community-note-media ${p.coverImage ? '' : 'text-only'}`}>
                {p.coverImage ? (
                  <img
                    className="community-note-cover"
                    src={p.coverImage}
                    alt={p.title || p.excerpt || '帖子图片'}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="community-note-text">
                    {p.excerpt || p.title || '来自农友的分享'}
                  </span>
                )}
                <span className={`community-tag community-note-tag tag-${p.category?.toLowerCase()}`}>
                  {CATEGORY_LABEL[p.category] || p.category}
                </span>
              </div>

              <div className="community-note-body">
                <h3 className="community-note-title">
                  {p.title || p.excerpt || '图片分享'}
                </h3>
                {p.title && p.excerpt && (
                  <p className="community-note-excerpt">{p.excerpt}</p>
                )}
                <div className="community-note-author">
                  <span className="community-avatar small">👨‍🌾</span>
                  <span className="community-note-author-name">{p.author}</span>
                  <span className="community-note-time">{p.createdAt}</span>
                </div>
              </div>
            </Link>

            <div className="community-note-actions">
              <button
                className={`community-like ${p.liked ? 'liked' : ''}`}
                onClick={() => toggleLike(p)}
              >
                {p.liked ? '❤️' : '🤍'} {p.likeCount}
              </button>
              <Link to={`/community/${p.id}`} className="community-comment-link">
                💬 {p.commentCount}
              </Link>
              {p.authorId === user?.userId && (
                <button
                  className="community-del"
                  onClick={async () => {
                    try {
                      await community.remove(p.id);
                      setPosts((prev) => prev.filter((x) => x.id !== p.id));
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  删除
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}