import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { community } from '../api';
import { useAuth } from '../context/AuthContext';
import PostContent from '../components/PostContent';

const CATEGORY_LABEL = { CHAT: '闲聊', TECH: '技术', ALERT: '预警' };

export default function CommunityPostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await community.detail(id);
      setPost(d.post);
      setComments(d.comments || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPreview('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const submitComment = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const c = await community.comment(id, text);
      setComments((prev) => [...prev, c]);
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      setInput('');
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async () => {
    if (!post) return;
    const prev = post;
    setPost({ ...post, liked: !post.liked, likeCount: post.likeCount + (post.liked ? -1 : 1) });
    try {
      const updated = post.liked
        ? await community.unlike(post.id)
        : await community.like(post.id);
      setPost(updated);
    } catch (e) {
      setPost(prev);
      setError(e.message);
    }
  };

  if (loading) return <p className="empty-text">加载中…</p>;

  if (!post) {
    return (
      <div className="community-detail">
        <button className="subpage-back" onClick={() => navigate('/community')}>‹</button>
        <p className="empty-text">{error || '帖子不存在'}</p>
      </div>
    );
  }

  return (
    <div className="community-detail">
      <div className="subpage-bar">
        <button className="subpage-back" onClick={() => navigate('/community')} aria-label="返回社区">
          ‹
        </button>
        <span className="subpage-title">帖子详情</span>
      </div>

      {error && <div className="agent-error">{error}</div>}

      <article className="glass community-post">
        <div className="community-post-head">
          <div className="community-author">
            <span className="community-avatar">👨‍🌾</span>
            <div>
              <div className="community-author-name">{post.author}</div>
              <div className="community-time">{post.createdAt}</div>
            </div>
          </div>
          <span className={`community-tag tag-${post.category?.toLowerCase()}`}>
            {CATEGORY_LABEL[post.category] || post.category}
          </span>
        </div>

        {post.title && <h3 className="community-post-title">{post.title}</h3>}
        <PostContent
          content={post.content}
          contentFormat={post.contentFormat}
          onImageClick={setPreview}
        />

        <div className="community-post-foot">
          <button
            className={`community-like ${post.liked ? 'liked' : ''}`}
            onClick={toggleLike}
          >
            {post.liked ? '❤️' : '🤍'} {post.likeCount}
          </button>
          <span className="community-comment-link">💬 {post.commentCount}</span>
        </div>
      </article>

      <section className="community-comments">
        <h3 className="community-comments-title">评论（{comments.length}）</h3>

        {comments.length === 0 && <p className="empty-text">还没有评论</p>}

        {comments.map((c) => (
          <div key={c.id} className="glass community-comment">
            <div className="community-comment-head">
              <span className="community-avatar small">👨‍🌾</span>
              <span className="community-author-name">{c.author}</span>
              <span className="community-time">{c.createdAt}</span>
            </div>
            <p className="community-comment-text">{c.content}</p>
          </div>
        ))}

        <div className="glass community-comment-box">
          <textarea
            className="community-textarea"
            placeholder={`以 ${user?.username || '我'} 的身份评论…`}
            rows={2}
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={submitComment}
            disabled={!input.trim() || sending}
          >
            {sending ? '发送中…' : '评论'}
          </button>
        </div>
      </section>

      {preview && (
        <div
          className="image-lightbox"
          onClick={() => setPreview('')}
          role="dialog"
          aria-label="查看原图"
        >
          <img
            src={preview}
            alt="原图"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="image-lightbox-close"
            onClick={() => setPreview('')}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
