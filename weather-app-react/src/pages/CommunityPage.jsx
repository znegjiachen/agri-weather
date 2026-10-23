import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { community } from '../api';
import { useAuth } from '../context/AuthContext';
import RichTextEditor from '../components/RichTextEditor';

const CATEGORY_LABEL = { TECH: '农技', CHAT: '闲聊', ALERT: '预警' };
const TABS = [
  { key: 'ALL', label: '全部' },
  { key: 'TECH', label: '农技' },
  { key: 'CHAT', label: '闲聊' },
  { key: 'ALERT', label: '预警' },
];
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
    coverWidth: null,
    coverHeight: null,
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

/** 图片卡片比例：用原图宽高，极端长图/长横幅夹在 2:3 ~ 1.9:1，避免卡片过长 */
function coverRatio(post) {
  if (!post.coverWidth || !post.coverHeight) return 0.8;
  return Math.min(1.9, Math.max(0.66, post.coverWidth / post.coverHeight));
}

/** 根据容器宽度算瀑布流列数：手机 2 列，桌面最多 4 列 */
function useColumnCount(gridRef) {
  const [count, setCount] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth <= 640 ? 2 : 4
  ));

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return undefined;
    const update = () => {
      const width = el.clientWidth;
      const gap = width <= 640 ? 10 : 16;
      setCount(Math.max(2, Math.min(4, Math.floor((width + gap) / (200 + gap)))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [gridRef]);

  return count;
}

export default function CommunityPage() {
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState('ALL');

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CHAT');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorState, setEditorState] = useState({ textLength: 0, imageCount: 0 });

  const editorRef = useRef(null);
  const gridRef = useRef(null);
  const columnCount = useColumnCount(gridRef);

  /**
   * 瀑布流分列：按顺序把下一张卡片放进当前「估算高度」最短的列。
   * 这样既保持新帖靠前，又不会像 CSS columns 那样把新帖全堆在左列。
   */
  const columns = useMemo(() => {
    const cols = Array.from({ length: columnCount }, () => ({ items: [], score: 0 }));
    for (const post of posts) {
      const target = cols.reduce((a, b) => (a.score <= b.score ? a : b));
      target.items.push(post);
      const media = post.coverImage ? 1 / coverRatio(post) : 1;
      target.score += media + (post.title ? 0.28 : 0) + 0.2;
    }
    return cols;
  }, [posts, columnCount]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await community.list(null, 20, {
        q: debouncedQuery,
        category: tab === 'ALL' ? null : tab,
      }));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, tab]);

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

  const removePost = async (post) => {
    try {
      await community.remove(post.id);
      setPosts((prev) => prev.filter((x) => x.id !== post.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const filtersActive = debouncedQuery !== '' || tab !== 'ALL';

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

      <div className="community-search">
        <span className="community-search-icon" aria-hidden>🔍</span>
        <input
          type="search"
          placeholder="搜索社区热门话题"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="community-search-clear"
            onClick={() => setQuery('')}
            aria-label="清空搜索"
          >
            ×
          </button>
        )}
      </div>

      <div className="community-tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`community-tab ${tab === item.key ? 'active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
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
          <p className="empty-text">
            {filtersActive ? '没有找到相关帖子' : '还没有帖子，来发第一条吧'}
          </p>
        </div>
      )}

      <div className="community-grid" ref={gridRef}>
        {columns.map((column, columnIndex) => (
          <div className="community-col" key={columnIndex}>
            {column.items.map((p) => (
              <article key={p.id} className="glass community-note">
                <Link to={`/community/${p.id}`} className="community-note-link">
                  <div
                    className={`community-note-media ${p.coverImage ? '' : 'text-only'}`}
                    style={{ aspectRatio: p.coverImage ? coverRatio(p) : 1 }}
                  >
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
                  </div>

                  {p.title && (
                    <div className="community-note-body">
                      <h3 className="community-note-title">{p.title}</h3>
                    </div>
                  )}
                </Link>

                <div className="community-note-foot">
                  <span className="community-avatar small">👨‍🌾</span>
                  <span className="community-note-author-name">{p.author}</span>

                  <span className="community-note-actions">
                    <button
                      className={`community-like ${p.liked ? 'liked' : ''}`}
                      onClick={() => toggleLike(p)}
                      aria-label={p.liked ? '取消点赞' : '点赞'}
                    >
                      {p.liked ? '❤️' : '🤍'} {p.likeCount}
                    </button>
                    <Link to={`/community/${p.id}`} className="community-comment-link">
                      💬 {p.commentCount}
                    </Link>
                    {p.authorId === user?.userId && (
                      <button
                        className="community-note-del"
                        onClick={() => removePost(p)}
                        aria-label="删除帖子"
                      >
                        🗑
                      </button>
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>

      {!composing && (
        <button
          type="button"
          className="community-fab"
          onClick={() => {
            setComposing(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="community-fab-plus">＋</span> 发布内容
        </button>
      )}
    </div>
  );
}