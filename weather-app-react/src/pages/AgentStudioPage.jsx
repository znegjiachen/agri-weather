import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agent as agentApi, agents as agentsApi } from '../api';
import { TOOL_LABELS } from '../utils/agentTools';
import { formatCommunityTime } from '../utils/date';
import { publishFieldContext } from '../utils/fieldContext';

const ALL_TOOLS = Object.entries(TOOL_LABELS).map(([name, meta]) => ({ name, ...meta }));

function fileIcon(doc) {
  const name = (doc.originalFilename || '').toLowerCase();
  if (name.endsWith('.pdf')) return '📕';
  if (name.endsWith('.doc') || name.endsWith('.docx')) return '📘';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return '📝';
  return '📄';
}

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
  const [agentQuery, setAgentQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [tab, setTab] = useState('persona');

  const [form, setForm] = useState({
    name: '',
    welcome: '',
    persona: '',
    avatar: '',
    enabledTools: [],
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [runtimeStatus, setRuntimeStatus] = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');

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

  useEffect(() => {
    let alive = true;
    agentApi.status()
      .then((data) => { if (alive) setRuntimeStatus(data); })
      .catch(() => {});
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
          enabledTools: Array.isArray(data.enabledTools)
            ? data.enabledTools
            : ALL_TOOLS.map((tool) => tool.name),
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

  const dirty = useMemo(() => {
    if (!detail) return false;
    const normalize = (value) => (value || '').trim();
    const detailTools = Array.isArray(detail.enabledTools)
      ? [...detail.enabledTools].sort()
      : ALL_TOOLS.map((tool) => tool.name).sort();
    const formTools = [...form.enabledTools].sort();
    return normalize(form.name) !== normalize(detail.name)
      || normalize(form.welcome) !== normalize(detail.welcome)
      || normalize(form.persona) !== normalize(detail.persona)
      || normalize(form.avatar) !== normalize(detail.avatar)
      || JSON.stringify(detailTools) !== JSON.stringify(formTools);
  }, [detail, form]);

  const filteredAgents = useMemo(() => {
    const query = agentQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((item) => (
      [item.name, item.farmlandName, item.cropName]
        .filter(Boolean).join(' ').toLowerCase().includes(query)
    ));
  }, [agents, agentQuery]);

  // 选中哪个智能体，右侧预览浮窗就切到哪个
  useEffect(() => {
    if (!detail) return;
    publishFieldContext({
      id: detail.farmlandId,
      name: detail.farmlandName,
      cropName: detail.cropName || '',
      agentId: detail.id,
      agentName: detail.name,
    });
  }, [detail]);

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
    if (!selectedId || !form.name.trim() || !form.persona.trim() || form.enabledTools.length === 0) return;
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
        enabledTools: Array.isArray(updated.enabledTools)
          ? updated.enabledTools
          : form.enabledTools,
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
        enabledTools: Array.isArray(updated.enabledTools)
          ? updated.enabledTools
          : form.enabledTools,
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

  const uploadFile = async (file) => {
    if (!file || !selectedId) return;
    if (!/\.(txt|md|markdown|pdf|doc|docx)$/i.test(file.name)) {
      setKbError('目前支持 TXT、Markdown、PDF、Word（doc/docx）');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setKbError('知识文件不能超过 5MB');
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

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) uploadFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const toggleTool = (name) => {
    setForm((prev) => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(name)
        ? prev.enabledTools.filter((item) => item !== name)
        : [...prev.enabledTools, name],
    }));
  };

  const setAllTools = (on) => {
    setForm((prev) => ({
      ...prev,
      enabledTools: on ? ALL_TOOLS.map((tool) => tool.name) : [],
    }));
  };

  const handleReindex = async () => {
    if (!selectedId) return;
    setReindexing(true);
    setReindexMsg('');
    setKbError('');
    try {
      await agentsApi.knowledge.reindex(selectedId);
      setReindexMsg('向量索引已重建');
    } catch (e) {
      setKbError(e.message || '重建向量失败');
    } finally {
      setReindexing(false);
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
        <div className="studio-head-title">
          <span className="studio-kicker">AGENT STUDIO</span>
          <h1>智能体控制台</h1>
          <p>每块地一个专属助农手 · 人设、知识库与工具互相独立</p>
        </div>
        <div className="studio-head-actions">
          <span className="studio-count-pill">{agents.length} 个智能体</span>
          <button type="button" className="btn-cancel studio-sync" onClick={handleSync} disabled={syncing}>
            {syncing ? '同步中…' : '↻ 同步地块'}
          </button>
        </div>
      </header>

      {listError && <div className="agent-error studio-error">{listError}</div>}

      <div className="studio-layout">
        <aside className="studio-sidebar glass">
          <div className="studio-search">
            <span aria-hidden="true">🔍</span>
            <input
              value={agentQuery}
              placeholder="搜索智能体或地块"
              onChange={(e) => setAgentQuery(e.target.value)}
            />
          </div>

          <div className="studio-side-head">
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
          ) : filteredAgents.length === 0 ? (
            <p className="empty-text">没有匹配的智能体</p>
          ) : (
            <div className="studio-items">
              {filteredAgents.map((item) => (
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

          <button type="button" className="studio-add-btn" onClick={() => navigate('/home/farmlands')}>
            ＋ 添加地块
          </button>
        </aside>

        <section className="studio-workspace glass">
          {detailError && <div className="agent-error">{detailError}</div>}

          {!detail ? (
            <p className="empty-text studio-detail-empty">
              {selectedId ? '正在读取智能体…' : '选择左侧的助农手开始配置'}
            </p>
          ) : (
            <>
              <header className="studio-agent-head">
                <span className="studio-avatar big">{detail.avatar || '🌾'}</span>
                <div className="studio-agent-info">
                  <div className="studio-agent-name-row">
                    <h2>{detail.name}</h2>
                    <span className="studio-online"><i />在线</span>
                    {detail.personaCustom && <span className="studio-badge">已自定义</span>}
                  </div>
                  <p>
                    📍 {detail.farmlandName} · {detail.cropName || '未设置作物'}
                    {' · '}{detail.docCount} 篇知识 · {detail.chunkCount} 个片段
                  </p>
                </div>
                <button type="button" className="btn-cancel studio-open-chat" onClick={openChat}>
                  打开完整对话 ↗
                </button>
              </header>

              <div className="studio-tabs">
                <button type="button" className={tab === 'persona' ? 'active' : ''} onClick={() => setTab('persona')}>
                  🧑‍🌾 人设
                </button>
                <button type="button" className={tab === 'knowledge' ? 'active' : ''} onClick={openKnowledge}>
                  📚 知识库
                </button>
                <button type="button" className={tab === 'tools' ? 'active' : ''} onClick={() => setTab('tools')}>
                  🧰 工具
                </button>
              </div>

              {tab === 'persona' && (
                <div className="studio-tab-panel">
                  <section className="studio-section">
                    <div className="studio-section-head">
                      <div>
                        <h3>基础信息</h3>
                        <p>名称和欢迎语会显示在对话页与右侧浮窗里。</p>
                      </div>
                    </div>

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
                        头像
                        <input
                          value={form.avatar}
                          maxLength={16}
                          placeholder="🌾"
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
                  </section>

                  <section className="studio-section">
                    <div className="studio-section-head">
                      <div>
                        <h3>人设与边界</h3>
                        <p>描述它负责哪块地、该怎么做；不确定时允许它如实说不知道。</p>
                      </div>
                      <button type="button" className="studio-text-btn" onClick={handleReset} disabled={saving}>
                        恢复默认
                      </button>
                    </div>

                    <label className="studio-field">
                      <textarea
                        rows={10}
                        maxLength={4000}
                        value={form.persona}
                        onChange={(e) => setForm({ ...form, persona: e.target.value })}
                      />
                      <span className="studio-hint">{form.persona.length} / 4000 字</span>
                    </label>
                  </section>

                  <div className="studio-savebar">
                    <span className={`studio-save-state ${dirty ? 'dirty' : ''}`}>
                      {dirty ? '有未保存的修改' : (saveMsg || '已保存')}
                    </span>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSave}
                      disabled={saving || !dirty || !form.name.trim() || !form.persona.trim() || form.enabledTools.length === 0}
                    >
                      {saving ? '保存中…' : '保存更改'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'tools' && (
                <div className="studio-tab-panel">
                  <section className="studio-section">
                    <div className="studio-section-head">
                      <div>
                        <h3>工具与能力</h3>
                        <p>关闭后模型看不到该工具，也不会再执行它；至少保留一个。</p>
                      </div>
                      <span className="studio-tools-count">
                        {form.enabledTools.length} / {ALL_TOOLS.length} 已启用
                      </span>
                    </div>

                    <div className="studio-tool-list">
                      {ALL_TOOLS.map((tool) => {
                        const checked = form.enabledTools.includes(tool.name);
                        return (
                          <div className={`studio-tool-row ${checked ? 'on' : ''}`} key={tool.name}>
                            <span className="studio-tool-icon">{tool.icon}</span>
                            <div className="studio-tool-info">
                              <div className="studio-tool-name-row">
                                <b>{tool.label}</b>
                                <code>{tool.name}</code>
                              </div>
                              <p>{tool.desc}</p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={checked}
                              className={`studio-switch ${checked ? 'on' : ''}`}
                              onClick={() => toggleTool(tool.name)}
                              title={checked ? '关闭该工具' : '启用该工具'}
                            >
                              <span />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="studio-tool-controls">
                      <button type="button" className="studio-text-btn" onClick={() => setAllTools(true)}>全部启用</button>
                      <button type="button" className="studio-text-btn" onClick={() => setAllTools(false)}>全部关闭</button>
                      {form.enabledTools.length === 0 && (
                        <span className="studio-tools-warn">至少保留一个工具</span>
                      )}
                    </div>
                  </section>

                  <div className="studio-savebar">
                    <span className={`studio-save-state ${dirty ? 'dirty' : ''}`}>
                      {dirty ? '工具配置有未保存的修改' : (saveMsg || '已保存')}
                    </span>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSave}
                      disabled={saving || !dirty || form.enabledTools.length === 0}
                    >
                      {saving ? '保存中…' : '保存更改'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'knowledge' && (
                <div className="studio-tab-panel">
                  <section className="studio-section studio-builtin-card">
                    <details>
                      <summary>
                        <span className="studio-builtin-title">
                          🌱 内置作物档案
                          <span className="studio-badge green">自动同步</span>
                        </span>
                        <span className="studio-builtin-hint">随地块作物和种植日期实时生成</span>
                      </summary>
                      <pre>{detail.builtinKnowledge}</pre>
                    </details>
                  </section>

                  <div className="studio-kb-actions">
                    <button
                      type="button"
                      className={`studio-dropzone ${dragActive ? 'drag-active' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      disabled={uploading}
                    >
                      <span className="studio-drop-icon">{uploading ? '⏳' : '⬆️'}</span>
                      <b>{uploading ? '上传中…' : (dragActive ? '松手即可上传' : '拖拽文件到这里，或点击上传')}</b>
                      <span>TXT / Markdown / PDF / Word · 单文件 ≤5MB</span>
                    </button>
                    <button type="button" className="studio-text-btn" onClick={() => setShowTextForm(true)}>
                      ＋ 添加文本
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.markdown,.pdf,.doc,.docx,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      hidden
                      onChange={handleFile}
                    />
                  </div>

                  {kbError && <div className="agent-error">{kbError}</div>}

                  <section className="studio-section">
                    <div className="studio-section-head">
                      <div>
                        <h3>知识文档</h3>
                        <p>每次提问会检索最相关的片段注入对话，回答下方会标注引用来源。</p>
                      </div>
                      <span className="studio-doc-count">{docs === null ? '—' : docs.length} 篇</span>
                    </div>

                    {docs === null ? (
                      <p className="empty-text">加载知识库…</p>
                    ) : docs.length === 0 ? (
                      <div className="studio-doc-empty">
                        <span>📄</span>
                        <p>还没有自定义知识，先上传一份种植规范或防治资料。</p>
                      </div>
                    ) : (
                      <div className="studio-doc-list">
                        {docs.map((doc) => (
                          <div className="studio-doc-row" key={doc.id}>
                            <span className="studio-doc-icon">{fileIcon(doc)}</span>
                            <div className="studio-doc-info">
                              <b>{doc.title}</b>
                              <span>
                                {doc.sourceType === 'FILE' ? (doc.originalFilename || '文件') : '粘贴文本'}
                                {' · '}{doc.charCount || 0} 字 · {doc.chunkCount} 个片段
                                {doc.createdAt ? ` · ${formatCommunityTime(doc.createdAt)}` : ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="studio-doc-del"
                              onClick={() => handleDeleteDoc(doc)}
                              aria-label="删除知识文档"
                              title="删除"
                            >
                              🗑
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="studio-kb-grid">
                    <section className="studio-section studio-embedding-card">
                      <div className="studio-section-head">
                        <div>
                          <h3>向量检索</h3>
                          <p>关键词与向量混合排序；切换模型后可重建索引。</p>
                        </div>
                        <span className={`studio-vector-dot ${runtimeStatus?.embeddingMode === 'external' ? 'on' : ''}`} />
                      </div>
                      <div className="studio-embedding-status">
                        {runtimeStatus?.embeddingMode === 'external'
                          ? `已启用 · ${runtimeStatus.embeddingModel}`
                          : '本地字词向量（配置 EMBEDDING_* 可接入语义模型）'}
                      </div>
                      <button
                        type="button"
                        className="studio-text-btn"
                        onClick={handleReindex}
                        disabled={reindexing || !docs?.length}
                      >
                        {reindexing ? '重建中…' : '重建向量索引'}
                      </button>
                      {reindexMsg && <span className="studio-save-msg">{reindexMsg}</span>}
                    </section>

                    <section className="studio-section studio-search-card">
                      <div className="studio-section-head">
                        <div>
                          <h3>检索测试</h3>
                          <p>输入一个问题，看看知识库能命中哪些片段。</p>
                        </div>
                      </div>
                      <div className="studio-search-row">
                        <input
                          value={searchQuery}
                          placeholder="例如：玉米灰斑病怎么防治"
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                        />
                        <button
                          type="button"
                          className="studio-text-btn"
                          onClick={handleSearch}
                          disabled={searching || !searchQuery.trim()}
                        >
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
                    </section>
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
              <div>
                <h2>添加知识文本</h2>
                <p>适合粘贴农技资料、防治经验或本地种植规范。</p>
              </div>
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
