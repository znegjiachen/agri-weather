import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agents as agentsApi } from '../api';

/**
 * 智能体控制台（桌面端 /agent）。
 *
 * 左侧是地块智能体列表，右侧编辑人设和知识库；
 * 日常对话仍走右侧浮窗或 /agent/chat。
 */
export default function AgentStudioPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [tab, setTab] = useState('persona');

  const [form, setForm] = useState({ name: '', welcome: '', persona: '', avatar: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [docs, setDocs] = useState(null);
  const [docsVersion, setDocsVersion] = useState(0);
  const [kbError, setKbError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [showTextForm, setShowTextForm] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [adding, setAdding] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const reloadList = useCallback(async () => {
    const data = await agentsApi.list();
    setAgents(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let alive = true;
    agentsApi.list()
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setAgents(list);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch((e) => { if (alive) setListError(e.message || '加载失败'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // 选中智能体后加载详情；错误只影响右侧面板
  useEffect(() => {
    if (!selectedId) return undefined;
    let alive = true;
    agentsApi.get(selectedId)
      .then((data) => {
        if (!alive) return;
        setDetail(data);
        setForm({
          name: data.name || '',
          welcome: data.welcome || '',
          persona: data.persona || '',
          avatar: data.avatar || '',
        });
      })
      .catch((e) => { if (alive) setDetailError(e.message || '加载智能体失败'); });
    return () => { alive = false; };
  }, [selectedId]);

  // 知识库只在切到该标签时加载
  useEffect(() => {
    if (tab !== 'knowledge' || !selectedId) return undefined;
    let alive = true;
    agentsApi.knowledge.list(selectedId)
      .then((data) => { if (alive) setDocs(Array.isArray(data) ? data : []); })
      .catch((e) => { if (alive) setKbError(e.message || '加载知识库失败'); });
    return () => { alive = false; };
  }, [selectedId, tab, docsVersion]);

  const selectAgent = (id) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setDetail(null);
    setDetailError('');
    setTab('persona');
    setDocs(null);
    setSaveMsg('');
    setKbError('');
    setSearchResults(null);
    setSearchQuery('');
    setShowTextForm(false);
  };

  const openKnowledge = () => {
    setTab('knowledge');
    setDocs(null);
    setKbError('');
    setSearchResults(null);
  };

  const openChat = () => {
    if (selectedId) navigate(`/agent/chat?agentId=${selectedId}`);
  };

  const handleSync = async () => {
    setSyncing(true);
    setListError('');
    try {
      const data = await agentsApi.sync();
      setAgents(Array.isArray(data) ? data : []);
      if (!selectedId && data?.length) setSelectedId(data[0].id);
    } catch (e) {
      setListError(e.message || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId || !form.name.trim() || !form.persona.trim()) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await agentsApi.update(selectedId, form);
      setDetail(updated);
      setForm({
        name: updated.name || '',
        welcome: updated.welcome || '',
        persona: updated.persona || '',
        avatar: updated.avatar || '',
      });
      setSaveMsg('已保存');
      await reloadList();
    } catch (e) {
      setDetailError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedId) return;
    if (!window.confirm('恢复默认人设会覆盖当前编辑内容，确定继续？')) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await agentsApi.reset(selectedId);
      setDetail(updated);
      setForm({
        name: updated.name || '',
        welcome: updated.welcome || '',
        persona: updated.persona || '',
        avatar: updated.avatar || '',
      });
      setSaveMsg('已恢复默认');
      await reloadList();
    } catch (e) {
      setDetailError(e.message || '恢复失败');
    } finally {
      setSaving(false);
    }
  };

  const refreshDocs = () => {
    setDocs(null);
    setDocsVersion((v) => v + 1);
    reloadList().catch(() => {});
  };

  const handleAddText = async () => {
    if (!selectedId || !textContent.trim()) return;
    setAdding(true);
    setKbError('');
    try {
      await agentsApi.knowledge.addText(selectedId, {
        title: textTitle.trim() || undefined,
        content: textContent,
      });
      setShowTextForm(false);
      setTextTitle('');
      setTextContent('');
      refreshDocs();
    } catch (e) {
      setKbError(e.message || '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedId) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      setKbError('目前只支持 TXT / Markdown 文本文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setKbError('知识文件不能超过 2MB');
      return;
    }
    setUploading(true);
    setKbError('');
    try {
      await agentsApi.knowledge.uploadFile(selectedId, file);
      refreshDocs();
    } catch (e) {
      setKbError(e.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!selectedId) return;
    if (!window.confirm(`删除知识《${doc.title}》？`)) return;
    setKbError('');
    try {
      await agentsApi.knowledge.remove(selectedId, doc.id);
      refreshDocs();
    } catch (e) {
      setKbError(e.message || '删除失败');
    }
  };

  const handleSearch = async () => {
    if (!selectedId || !searchQuery.trim()) return;
    setSearching(true);
    setKbError('');
    try {
      const data = await agentsApi.knowledge.search(selectedId, searchQuery.trim());
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setKbError(e.message || '检索失败');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="studio-page">
      <header className="studio-head">
        <div>
          <h1>智能体控制台</h1>
          <p>每块地一个专属助农手，人设和知识库互相独立</p>
        </div>
        <button type="button" className="btn-cancel studio-sync" onClick={handleSync} disabled={syncing}>
          {syncing ? '同步中…' : '↻ 同步地块'}
        </button>
      </header>

      {listError && <div className="agent-error studio-error">{listError}</div>}

      <div className="studio-layout">
        <aside className="studio-list glass">
          <div className="studio-list-head">
            <span>我的助农手</span>
            <b>{agents.length}</b>
          </div>

          {loading ? (
            <p className="empty-text">加载中…</p>
          ) : agents.length === 0 ? (
            <div className="studio-empty">
              <p>还没有地块智能体。</p>
              <button type="button" className="btn-primary" onClick={() => navigate('/home/farmlands')}>
                去添加地块
              </button>
            </div>
          ) : (
            <div className="studio-items">
              {agents.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`studio-item ${item.id === selectedId ? 'active' : ''}`}
                  onClick={() => selectAgent(item.id)}
                >
                  <span className="studio-avatar">{item.avatar || '🌾'}</span>
                  <span className="studio-item-main">
                    <b>{item.name}</b>
                    <span>{item.farmlandName} · {item.cropName || '未设置作物'}</span>
                  </span>
                  <span className="studio-item-count">{item.docCount} 篇</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="studio-detail glass">
          {detailError && <div className="agent-error">{detailError}</div>}

          {!detail ? (
            <p className="empty-text studio-detail-empty">
              {selectedId ? '正在读取智能体…' : '选择左侧的助农手开始配置'}
            </p>
          ) : (
            <>
              <div className="studio-detail-head">
                <div className="studio-detail-title">
                  <span className="studio-avatar big">{detail.avatar || '🌾'}</span>
                  <div>
                    <h2>{detail.name}</h2>
                    <p>
                      {detail.farmlandName} · {detail.cropName || '未设置作物'}
                      {' · '}{detail.docCount} 篇知识 · {detail.chunkCount} 个片段
                      {detail.personaCustom ? ' · 已自定义人设' : ''}
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-primary" onClick={openChat}>
                  打开对话
                </button>
              </div>

              <div className="studio-tabs">
                <button type="button" className={tab === 'persona' ? 'active' : ''} onClick={() => setTab('persona')}>
                  人设
                </button>
                <button type="button" className={tab === 'knowledge' ? 'active' : ''} onClick={openKnowledge}>
                  知识库
                </button>
              </div>

              {tab === 'persona' ? (
                <div className="studio-panel">
                  <div className="studio-form-row">
                    <label>
                      智能体名称
                      <input
                        value={form.name}
                        maxLength={100}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </label>
                    <label>
                      头像（emoji）
                      <input
                        value={form.avatar}
                        maxLength={16}
                        onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                      />
                    </label>
                  </div>

                  <label className="studio-field">
                    欢迎语
                    <input
                      value={form.welcome}
                      maxLength={500}
                      onChange={(e) => setForm({ ...form, welcome: e.target.value })}
                    />
                  </label>

                  <label className="studio-field">
                    专属人设
                    <textarea
                      rows={8}
                      maxLength={4000}
                      value={form.persona}
                      onChange={(e) => setForm({ ...form, persona: e.target.value })}
                    />
                    <span className="studio-hint">{form.persona.length} / 4000 字</span>
                  </label>

                  <div className="studio-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSave}
                      disabled={saving || !form.name.trim() || !form.persona.trim()}
                    >
                      {saving ? '保存中…' : '保存'}
                    </button>
                    <button type="button" className="btn-cancel" onClick={handleReset} disabled={saving}>
                      恢复默认
                    </button>
                    {saveMsg && <span className="studio-save-msg">{saveMsg}</span>}
                  </div>
                </div>
              ) : (
                <div className="studio-panel">
                  <div className="studio-builtin">
                    <h3>内置作物档案（自动同步，只读）</h3>
                    <pre>{detail.builtinKnowledge}</pre>
                  </div>

                  <div className="studio-kb-toolbar">
                    <button type="button" className="btn-primary" onClick={() => setShowTextForm(true)}>
                      ＋ 添加文本
                    </button>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? '上传中…' : '上传 TXT / Markdown'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.markdown,text/plain,text/markdown"
                      hidden
                      onChange={handleFile}
                    />
                    <span className="studio-kb-hint">最多 20 篇，单篇 ≤20 万字符，文件 ≤2MB</span>
                  </div>

                  {kbError && <div className="agent-error">{kbError}</div>}

                  {docs === null ? (
                    <p className="empty-text">加载知识库…</p>
                  ) : docs.length === 0 ? (
                    <p className="empty-text">还没有自定义知识，先添加一篇试试。</p>
                  ) : (
                    <div className="studio-docs">
                      {docs.map((doc) => (
                        <div className="studio-doc" key={doc.id}>
                          <div className="studio-doc-main">
                            <b>{doc.title}</b>
                            <span>
                              {doc.sourceType === 'FILE' ? (doc.originalFilename || '文件') : '粘贴文本'}
                              {' · '}{doc.charCount || 0} 字 · {doc.chunkCount} 个片段
                              {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString('zh-CN')}` : ''}
                            </span>
                          </div>
                          <button type="button" className="btn-del" onClick={() => handleDeleteDoc(doc)}>
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="studio-kb-search">
                    <h3>检索测试</h3>
                    <div className="studio-search-row">
                      <input
                        value={searchQuery}
                        placeholder="例如：玉米灰斑病怎么防治"
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                      />
                      <button type="button" className="btn-cancel" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                        {searching ? '检索中…' : '检索'}
                      </button>
                    </div>
                    {searchResults !== null && (
                      searchResults.length === 0 ? (
                        <p className="empty-text">没有命中片段</p>
                      ) : (
                        <div className="studio-search-results">
                          {searchResults.map((hit) => (
                            <div className="studio-search-hit" key={`${hit.docId}-${hit.score}`}>
                              <div><b>{hit.title}</b><span>相关度 {Number(hit.score).toFixed(2)}</span></div>
                              <p>{hit.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {showTextForm && (
        <div
          className="form-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTextForm(false); }}
        >
          <div className="form-card glass-heavy studio-text-form">
            <div className="studio-text-head">
              <h2>添加知识文本</h2>
              <button type="button" onClick={() => setShowTextForm(false)} aria-label="关闭">✕</button>
            </div>
            <label className="studio-field">
              标题（可选）
              <input
                value={textTitle}
                maxLength={200}
                placeholder="例如：玉米灰斑病防治要点"
                onChange={(e) => setTextTitle(e.target.value)}
              />
            </label>
            <label className="studio-field">
              内容
              <textarea
                rows={12}
                value={textContent}
                placeholder="粘贴农技资料、防治经验、本地种植规范…"
                onChange={(e) => setTextContent(e.target.value)}
              />
            </label>
            <div className="form-buttons">
              <button type="button" className="btn-primary" onClick={handleAddText} disabled={adding || !textContent.trim()}>
                {adding ? '保存中…' : '保存到知识库'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowTextForm(false)} disabled={adding}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}