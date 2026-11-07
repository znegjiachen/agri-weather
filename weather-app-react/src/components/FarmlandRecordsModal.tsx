import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { agent as agentApi, crops as cropsApi, farmlands as farmlandApi } from '../api';
import { errorMessage } from '../utils/errorMessage';
import type { Farmland } from '../types/farmland';

const SEASON_STATUS: Record<string, string> = { PLANTED: '在种', HARVESTED: '已收获', FALLOW: '休耕' };
const OPERATION_TYPES = ['施肥', '打药', '灌溉', '播种', '除草', '其他'];
const TASK_TYPES: Record<string, string> = {
  SOW: '播种', FERTILIZE: '施肥', SPRAY: '打药',
  IRRIGATE: '灌溉', HARVEST: '收获', OTHER: '其他',
};

/** 作物下拉项 */
interface CropOption {
  id: number;
  cropName: string;
}

/** 当前生育阶段接口返回 */
interface CropStage {
  stageName?: string;
}

/** 地块上的一个种植季 */
interface Season {
  id: number;
  cropId: number | null;
  seasonName?: string | null;
  plantDate?: string | null;
  expectedHarvestDate?: string | null;
  harvestDate?: string | null;
  status: string;
  notes?: string | null;
}

/** 一条农事操作记录 */
interface FarmOperation {
  id: number;
  operationType: string;
  operationDate: string;
  detail?: string | null;
  fertilizer?: string | null;
  pesticide?: string | null;
  operator?: string | null;
  notes?: string | null;
}

/** 计划任务（含方案解析出的临时任务） */
interface PlanTask {
  id: number;
  title: string;
  taskType: string;
  plannedDate?: string | null;
  actualDate?: string | null;
  status?: string;
  sourceName?: string | null;
  sourceQuote?: string | null;
}

interface TaskSummary {
  completionRate: number;
  onTimeRate: number;
  pending: number;
  overdue: number;
}

interface TaskGroup {
  date: string;
  items: PlanTask[];
}

/** 完成本季后返回的新季任务信息 */
interface CompleteSeasonResult {
  newSeason?: { seasonName?: string | null } | null;
  tasksCreated: number;
  warning?: string | null;
}

interface SeasonFormState {
  seasonName: string;
  cropId: string;
  plantDate: string;
  expectedHarvestDate: string;
  harvestDate: string;
  status: string;
  notes: string;
}

interface OperationFormState {
  operationType: string;
  operationDate: string;
  detail: string;
  fertilizer: string;
  pesticide: string;
  operator: string;
  notes: string;
}

interface CompleteFormState {
  cropId: string;
  plantDate: string;
  seasonName: string;
  planDocumentId: number | null;
  planName: string;
}

interface FarmlandRecordsModalProps {
  farmland: Farmland;
  cropList?: CropOption[];
  onClose: () => void;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function planDateLabel(value: string | null | undefined) {
  if (!value) return '日期待定';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - startOfToday.getTime()) / 86400000);
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const base = `${date.getMonth() + 1}月${date.getDate()}日 ${week}`;
  if (diff === 0) return `${base} · 今天`;
  if (diff === 1) return `${base} · 明天`;
  if (diff > 1) return `${base} · 还有 ${diff} 天`;
  return `${base} · 已逾期 ${-diff} 天`;
}

function groupTasksByDate(tasks: PlanTask[]): TaskGroup[] {
  const sorted = [...tasks].sort((a, b) => {
    if (!a.plannedDate && !b.plannedDate) return a.id - b.id;
    if (!a.plannedDate) return 1;
    if (!b.plannedDate) return -1;
    return a.plannedDate.localeCompare(b.plannedDate) || a.id - b.id;
  });
  const groups: TaskGroup[] = [];
  sorted.forEach((task) => {
    const key = task.plannedDate || '';
    let group = groups[groups.length - 1];
    if (!group || group.date !== key) {
      group = { date: key, items: [] };
      groups.push(group);
    }
    group.items.push(task);
  });
  return groups;
}

/** 地块季节历史 + 农事记录 */
export default function FarmlandRecordsModal({
  farmland,
  cropList = [],
  onClose,
}: FarmlandRecordsModalProps) {
  const [tab, setTab] = useState('seasons');
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [seasonStage, setSeasonStage] = useState<Record<number, string>>({});
  const [operations, setOperations] = useState<FarmOperation[] | null>(null);
  const [pendingTasks, setPendingTasks] = useState<PlanTask[]>([]);
  const [tasks, setTasks] = useState<PlanTask[] | null>(null);
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [completingSeason, setCompletingSeason] = useState<Season | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteFormState>({
    cropId: '',
    plantDate: today(),
    seasonName: '',
    planDocumentId: null,
    planName: '',
  });
  const [completePlanLoading, setCompletePlanLoading] = useState(false);
  const [completeResult, setCompleteResult] = useState<CompleteSeasonResult | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanTask[] | null>(null);
  const [planSourceName, setPlanSourceName] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [seasonForm, setSeasonForm] = useState<SeasonFormState>({
    seasonName: '',
    cropId: farmland?.cropId ? String(farmland.cropId) : '',
    plantDate: '',
    expectedHarvestDate: '',
    harvestDate: '',
    status: 'PLANTED',
    notes: '',
  });
  const [opForm, setOpForm] = useState<OperationFormState>({
    operationType: '施肥',
    operationDate: today(),
    detail: '',
    fertilizer: '',
    pesticide: '',
    operator: '',
    notes: '',
  });

  const cropName = (id: number | null) =>
    cropList.find((crop) => crop.id === id)?.cropName || '未选择作物';

  const load = async () => {
    setError('');
    try {
      if (tab === 'seasons') {
        const list = (await farmlandApi.seasons.list(farmland.id)) as Season[];
        setSeasons(list);
        // 按播种日期推算每个在种季节当前所处的生育阶段
        const entries = await Promise.all(list.map(async (season): Promise<[number, string] | null> => {
          if (!season.cropId || !season.plantDate || season.status !== 'PLANTED') return null;
          try {
            const stage = (await cropsApi.currentStage(season.cropId, season.plantDate)) as CropStage | null;
            return stage?.stageName ? [season.id, stage.stageName] : null;
          } catch {
            return null;
          }
        }));
        setSeasonStage(Object.fromEntries(
          entries.filter((entry): entry is [number, string] => entry !== null),
        ));
      } else if (tab === 'operations') {
        const [operationList, taskList] = await Promise.all([
          farmlandApi.farmOperations.list(farmland.id) as Promise<FarmOperation[]>,
          farmlandApi.tasks.list(farmland.id).catch(() => [] as PlanTask[]) as Promise<PlanTask[]>,
        ]);
        setOperations(operationList);
        setPendingTasks(
          (Array.isArray(taskList) ? taskList : []).filter((task) => task.status === 'PENDING'),
        );
      } else {
        const [taskList, summary] = await Promise.all([
          farmlandApi.tasks.list(farmland.id) as Promise<PlanTask[]>,
          farmlandApi.tasks.summary(farmland.id) as Promise<TaskSummary>,
        ]);
        setTasks(taskList);
        setTaskSummary(summary);
      }
    } catch (e) {
      setError(errorMessage(e, '加载失败'));
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.resolve();
      if (alive) await load();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, farmland.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submitSeason = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await farmlandApi.seasons.create(farmland.id, {
        ...seasonForm,
        cropId: seasonForm.cropId ? Number(seasonForm.cropId) : null,
        plantDate: seasonForm.plantDate || null,
        expectedHarvestDate: seasonForm.expectedHarvestDate || null,
        harvestDate: seasonForm.harvestDate || null,
      });
      setSeasonForm({
        seasonName: '',
        cropId: '',
        plantDate: '',
        expectedHarvestDate: '',
        harvestDate: '',
        status: 'PLANTED',
        notes: '',
      });
      await load();
    } catch (e) {
      setError(errorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const submitOperation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await farmlandApi.farmOperations.create(farmland.id, opForm);
      setOpForm({
        operationType: '施肥',
        operationDate: today(),
        detail: '',
        fertilizer: '',
        pesticide: '',
        operator: '',
        notes: '',
      });
      await load();
    } catch (e) {
      setError(errorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const removeSeason = async (id: number) => {
    if (!window.confirm('删除这条季节记录？')) return;
    try {
      await farmlandApi.seasons.remove(farmland.id, id);
      await load();
    } catch (e) {
      setError(errorMessage(e, '删除失败'));
    }
  };

  const removeOperation = async (id: number) => {
    if (!window.confirm('删除这条农事记录？')) return;
    try {
      await farmlandApi.farmOperations.remove(farmland.id, id);
      await load();
    } catch (e) {
      setError(errorMessage(e, '删除失败'));
    }
  };

  // 农事记录里直接完成计划任务，后台会同时生成一条农事操作
  const completePendingTask = async (task: PlanTask) => {
    setSaving(true);
    setError('');
    try {
      await farmlandApi.tasks.update(farmland.id, task.id, { status: 'DONE' });
      await load();
    } catch (e) {
      setError(errorMessage(e, '任务更新失败'));
    } finally {
      setSaving(false);
    }
  };

  const startCompleteSeason = (season: Season) => {
    setCompletingSeason(season);
    setCompleteResult(null);
    setError('');
    setCompleteForm({
      cropId: season.cropId ? String(season.cropId) : '',
      plantDate: today(),
      seasonName: '',
      planDocumentId: null,
      planName: '',
    });
  };

  const cancelCompleteSeason = () => {
    setCompletingSeason(null);
    setCompleteForm({
      cropId: '',
      plantDate: today(),
      seasonName: '',
      planDocumentId: null,
      planName: '',
    });
  };

  // 新一季计划文档：这里只上传拿 documentId，解析在完成本季接口里做
  const handleCompletePlanFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md|markdown|pdf|doc|docx)$/i.test(file.name)) {
      setError('方案文档支持 TXT、Markdown、PDF、Word');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('方案文档不能超过 5MB');
      return;
    }
    setCompletePlanLoading(true);
    setError('');
    try {
      const document = await agentApi.document(file);
      setCompleteForm((prev) => ({
        ...prev,
        planDocumentId: document.id,
        planName: document.filename || file.name,
      }));
    } catch (e) {
      setError(errorMessage(e, '方案上传失败'));
    } finally {
      setCompletePlanLoading(false);
    }
  };

  const submitCompleteSeason = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completingSeason) return;
    if (!completeForm.cropId) {
      setError('请选择新一季的作物');
      return;
    }
    if (!completeForm.plantDate) {
      setError('请选择新一季的播种日期');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await farmlandApi.seasons.complete(farmland.id, completingSeason.id, {
        cropId: Number(completeForm.cropId),
        plantDate: completeForm.plantDate,
        seasonName: completeForm.seasonName || null,
        planDocumentId: completeForm.planDocumentId,
        planName: completeForm.planName || null,
      });
      setCompleteResult(result);
      setCompletingSeason(null);
      await load();
    } catch (e) {
      setError(errorMessage(e, '完成本季失败'));
    } finally {
      setSaving(false);
    }
  };

  const handlePlanFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md|markdown|pdf|doc|docx)$/i.test(file.name)) {
      setError('方案文档支持 TXT、Markdown、PDF、Word');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('方案文档不能超过 5MB');
      return;
    }
    setPlanLoading(true);
    setError('');
    try {
      const document = await agentApi.document(file);
      const preview = await farmlandApi.tasks.extract(farmland.id, document.id);
      setPlanPreview(preview);
      setPlanSourceName(document.filename || file.name);
    } catch (e) {
      setError(errorMessage(e, '方案解析失败'));
    } finally {
      setPlanLoading(false);
    }
  };

  const savePlanTasks = async () => {
    if (!planPreview || planPreview.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await farmlandApi.tasks.confirm(farmland.id, {
        tasks: planPreview,
        sourceName: planSourceName,
      });
      setPlanPreview(null);
      setPlanSourceName('');
      await load();
    } catch (e) {
      setError(errorMessage(e, '任务保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (task: PlanTask, status: string) => {
    setSaving(true);
    setError('');
    try {
      await farmlandApi.tasks.update(farmland.id, task.id, { status });
      await load();
    } catch (e) {
      setError(errorMessage(e, '任务更新失败'));
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (taskId: number) => {
    if (!window.confirm('删除这条计划任务？')) return;
    try {
      await farmlandApi.tasks.remove(farmland.id, taskId);
      await load();
    } catch (e) {
      setError(errorMessage(e, '删除失败'));
    }
  };

  return (
    <div
      className="form-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="records-card glass-heavy" role="dialog" aria-modal="true" aria-label="地块记录">
        <div className="records-head">
          <div>
            <h3>{farmland.fieldName} · 地块记录</h3>
            <p>季节历史与农事操作分开记录，换茬不会覆盖上一季。</p>
          </div>
          <button type="button" className="records-close" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <div className="records-tabs">
          <button
            type="button"
            className={tab === 'seasons' ? 'active' : ''}
            onClick={() => setTab('seasons')}
          >
            种植季
          </button>
          <button
            type="button"
            className={tab === 'operations' ? 'active' : ''}
            onClick={() => setTab('operations')}
          >
            农事记录
          </button>
          <button
            type="button"
            className={tab === 'tasks' ? 'active' : ''}
            onClick={() => setTab('tasks')}
          >
            计划任务
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {tab === 'tasks' ? (
          <>
            <div className="records-plan-upload">
              <label className="records-upload-btn">
                📄 上传种植方案，生成任务
                <input
                  type="file"
                  accept=".txt,.md,.markdown,.pdf,.doc,.docx"
                  hidden
                  onChange={handlePlanFile}
                />
              </label>
              <span>支持 PDF / Word / TXT / Markdown，生成后需确认才保存</span>
              {planLoading && <span className="records-uploading">正在解析方案…</span>}
            </div>

            {planPreview && (
              <div className="records-preview">
                <div className="records-preview-head">
                  <b>识别到 {planPreview.length} 条任务</b>
                  <span>{planSourceName}</span>
                </div>
                {planPreview.map((task, index) => (
                  <div className="records-row" key={`${task.title}-${index}`}>
                    <div>
                      <b>{task.title}</b>
                      <span>
                        {TASK_TYPES[task.taskType] || '其他'}
                        {task.plannedDate ? ` · ${task.plannedDate}` : ' · 日期待定'}
                        {task.sourceQuote ? ` · 「${task.sourceQuote}」` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="records-danger"
                      onClick={() => setPlanPreview((prev) => (prev || []).filter((_, i) => i !== index))}
                    >
                      移除
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-primary" onClick={savePlanTasks} disabled={saving}>
                  {saving ? '保存中…' : '确认保存为任务'}
                </button>
              </div>
            )}

            {taskSummary && (
              <div className="records-summary">
                <span>完成率 <b>{taskSummary.completionRate}%</b></span>
                <span>按时率 <b>{taskSummary.onTimeRate}%</b></span>
                <span>待办 <b>{taskSummary.pending}</b></span>
                <span className={taskSummary.overdue > 0 ? 'warn' : ''}>逾期 <b>{taskSummary.overdue}</b></span>
              </div>
            )}

            <div className="records-list">
              {tasks === null ? <p className="empty-text">加载中…</p>
                : tasks.length === 0 ? (
                  <p className="empty-text">还没有计划任务，上传一份种植方案试试。</p>
                ) : groupTasksByDate(tasks).map((group) => (
                  <div className="records-day-group" key={group.date || 'undated'}>
                    <div className="records-day-head">
                      <span className="records-day-title">{planDateLabel(group.date)}</span>
                      <span className="records-day-count">{group.items.length} 项</span>
                    </div>
                    {group.items.map((task) => (
                      <div className="records-row" key={task.id}>
                        <div>
                          <b>{task.title}</b>
                          <span>
                            {TASK_TYPES[task.taskType] || '其他'}
                            {task.plannedDate ? ` · 计划 ${task.plannedDate}` : ''}
                            {task.actualDate ? ` · 实际 ${task.actualDate}` : ''}
                            {task.sourceName ? ` · ${task.sourceName}` : ''}
                          </span>
                        </div>
                        <span className={`records-status ${task.status?.toLowerCase()}`}>
                          {task.status === 'DONE' ? '已完成' : task.status === 'SKIPPED' ? '已跳过' : '待执行'}
                        </span>
                        {task.status === 'PENDING' && (
                          <>
                            <button type="button" className="records-task-done" onClick={() => updateTask(task, 'DONE')} disabled={saving}>
                              完成
                            </button>
                            <button type="button" className="records-danger" onClick={() => updateTask(task, 'SKIPPED')} disabled={saving}>
                              跳过
                            </button>
                          </>
                        )}
                        <button type="button" className="records-danger" onClick={() => removeTask(task.id)}>
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </>
        ) : tab === 'seasons' ? (
          <>
            {completeResult && (
              <div className="records-complete-result">
                <div>
                  <b>已开启新一季：{completeResult.newSeason?.seasonName || '新一季'}</b>
                  <span>
                    {completeResult.tasksCreated > 0
                      ? `已从种植计划生成 ${completeResult.tasksCreated} 条任务，可在「计划任务 / 农事记录」查看`
                      : '未上传新一季种植计划，可稍后在计划任务里补充'}
                    {completeResult.warning ? ` · ${completeResult.warning}` : ''}
                  </span>
                </div>
                <button type="button" className="records-complete-close" onClick={() => setCompleteResult(null)}>
                  知道了
                </button>
              </div>
            )}

            {completingSeason && (
              <form className="records-form records-complete-form" onSubmit={submitCompleteSeason}>
                <div className="records-complete-head">
                  <b>完成「{completingSeason.seasonName || cropName(completingSeason.cropId)}」，开始新一季</b>
                  <span>旧季标记为已收获，未完成的计划任务会自动跳过。</span>
                </div>
                <div className="records-grid">
                  <label>新一季作物
                    <select
                      value={completeForm.cropId}
                      onChange={(e) => setCompleteForm({ ...completeForm, cropId: e.target.value })}
                    >
                      <option value="">请选择</option>
                      {cropList.map((crop) => (
                        <option key={crop.id} value={crop.id}>{crop.cropName}</option>
                      ))}
                    </select>
                  </label>
                  <label>新一季播种日期
                    <input
                      type="date"
                      value={completeForm.plantDate}
                      onChange={(e) => setCompleteForm({ ...completeForm, plantDate: e.target.value })}
                    />
                  </label>
                  <label>季名
                    <input
                      value={completeForm.seasonName}
                      maxLength={50}
                      placeholder="如 2027 早稻（可选）"
                      onChange={(e) => setCompleteForm({ ...completeForm, seasonName: e.target.value })}
                    />
                  </label>
                </div>
                <div className="records-plan-field">
                  <span className="records-plan-label">新一季种植计划（可选，自动生成任务）</span>
                  <div className="records-plan-line">
                    <label className="records-upload-btn">
                      📄 {completeForm.planName || '选择方案文件'}
                      <input
                        type="file"
                        accept=".txt,.md,.markdown,.pdf,.doc,.docx"
                        hidden
                        onChange={handleCompletePlanFile}
                      />
                    </label>
                    <span>{completePlanLoading ? '正在上传…' : '支持 PDF / Word / TXT / Markdown'}</span>
                  </div>
                </div>
                <div className="records-complete-actions">
                  <button type="button" className="btn-cancel" onClick={cancelCompleteSeason}>取消</button>
                  <button type="submit" className="btn-primary" disabled={saving || completePlanLoading}>
                    {saving ? '处理中…' : '完成并开始新一季'}
                  </button>
                </div>
              </form>
            )}

            <form className="records-form" onSubmit={submitSeason}>
              <div className="records-grid">
                <label>季名
                  <input
                    value={seasonForm.seasonName}
                    maxLength={50}
                    placeholder="如 2026 早稻"
                    onChange={(e) => setSeasonForm({ ...seasonForm, seasonName: e.target.value })}
                  />
                </label>
                <label>作物
                  <select
                    value={seasonForm.cropId}
                    onChange={(e) => setSeasonForm({ ...seasonForm, cropId: e.target.value })}
                  >
                    <option value="">未选择</option>
                    {cropList.map((crop) => (
                      <option key={crop.id} value={crop.id}>{crop.cropName}</option>
                    ))}
                  </select>
                </label>
                <label>播种日期
                  <input type="date" value={seasonForm.plantDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, plantDate: e.target.value })} />
                </label>
                <label>预计收获
                  <input type="date" value={seasonForm.expectedHarvestDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, expectedHarvestDate: e.target.value })} />
                </label>
                <label>实际收获
                  <input type="date" value={seasonForm.harvestDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, harvestDate: e.target.value })} />
                </label>
                <label>状态
                  <select value={seasonForm.status}
                    onChange={(e) => setSeasonForm({ ...seasonForm, status: e.target.value })}>
                    {Object.entries(SEASON_STATUS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>备注
                <input value={seasonForm.notes} maxLength={500}
                  onChange={(e) => setSeasonForm({ ...seasonForm, notes: e.target.value })} />
              </label>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '保存中…' : '新增一季'}
              </button>
            </form>

            <div className="records-list">
              {seasons === null ? <p className="empty-text">加载中…</p>
                : seasons.length === 0 ? <p className="empty-text">还没有季节记录，先添加当前这一季。</p>
                  : seasons.map((season) => (
                    <div className="records-row" key={season.id}>
                      <div>
                        <b>{season.seasonName || cropName(season.cropId)}</b>
                        <span>
                          {cropName(season.cropId)}
                          {season.plantDate ? ` · 播种 ${season.plantDate}` : ''}
                          {season.harvestDate ? ` · 收获 ${season.harvestDate}` : ''}
                          {season.status === 'PLANTED' && seasonStage[season.id]
                            ? ` · 当前 ${seasonStage[season.id]}`
                            : ''}
                        </span>
                      </div>
                      <span className={`records-status ${season.status?.toLowerCase()}`}>
                        {SEASON_STATUS[season.status] || season.status}
                      </span>
                      {season.status === 'PLANTED' && (
                        <button
                          type="button"
                          className="records-complete-btn"
                          onClick={() => startCompleteSeason(season)}
                        >
                          完成本季
                        </button>
                      )}
                      <button type="button" className="records-danger" onClick={() => removeSeason(season.id)}>
                        删除
                      </button>
                    </div>
                  ))}
            </div>
          </>
        ) : (
          <>
            {pendingTasks.length > 0 && (
              <div className="records-pending">
                <div className="records-pending-head">
                  <b>🌱 待办农事（{pendingTasks.length}）</b>
                  <span>点击完成会自动记入下方的农事记录</span>
                </div>
                {pendingTasks.map((task) => {
                  const overdue = task.plannedDate && task.plannedDate < today();
                  return (
                    <div className={`records-pending-row ${overdue ? 'overdue' : ''}`} key={task.id}>
                      <div>
                        <b>{task.title}</b>
                        <span>
                          {TASK_TYPES[task.taskType] || '其他'}
                          {task.plannedDate
                            ? ` · ${overdue ? '已逾期，计划 ' : '计划 '}${task.plannedDate}`
                            : ' · 日期待定'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="records-task-done"
                        onClick={() => completePendingTask(task)}
                        disabled={saving}
                      >
                        完成
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <form className="records-form" onSubmit={submitOperation}>
              <div className="records-grid">
                <label>类型
                  <select value={opForm.operationType}
                    onChange={(e) => setOpForm({ ...opForm, operationType: e.target.value })}>
                    {OPERATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label>日期
                  <input type="date" value={opForm.operationDate}
                    onChange={(e) => setOpForm({ ...opForm, operationDate: e.target.value })} />
                </label>
                <label>肥料
                  <input value={opForm.fertilizer} maxLength={100}
                    onChange={(e) => setOpForm({ ...opForm, fertilizer: e.target.value })} />
                </label>
                <label>农药
                  <input value={opForm.pesticide} maxLength={100}
                    onChange={(e) => setOpForm({ ...opForm, pesticide: e.target.value })} />
                </label>
                <label>操作人
                  <input value={opForm.operator} maxLength={50}
                    onChange={(e) => setOpForm({ ...opForm, operator: e.target.value })} />
                </label>
                <label>详情
                  <input value={opForm.detail} maxLength={500}
                    onChange={(e) => setOpForm({ ...opForm, detail: e.target.value })} />
                </label>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '保存中…' : '新增农事记录'}
              </button>
            </form>

            <div className="records-list">
              {operations === null ? <p className="empty-text">加载中…</p>
                : operations.length === 0 ? <p className="empty-text">还没有农事记录。</p>
                  : operations.map((operation) => (
                    <div className="records-row" key={operation.id}>
                      <div>
                        <b>{operation.operationType} · {operation.operationDate}</b>
                        <span>
                          {operation.detail || '无详情'}
                          {operation.fertilizer ? ` · 肥料 ${operation.fertilizer}` : ''}
                          {operation.pesticide ? ` · 农药 ${operation.pesticide}` : ''}
                        </span>
                      </div>
                      <button type="button" className="records-danger" onClick={() => removeOperation(operation.id)}>
                        删除
                      </button>
                    </div>
                  ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}