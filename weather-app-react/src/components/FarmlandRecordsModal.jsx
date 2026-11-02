import { useEffect, useState } from 'react';
import { farmlands as farmlandApi } from '../api';

const SEASON_STATUS = { PLANTED: '在种', HARVESTED: '已收获', FALLOW: '休耕' };
const OPERATION_TYPES = ['施肥', '打药', '灌溉', '播种', '除草', '其他'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** 地块季节历史 + 农事记录 */
export default function FarmlandRecordsModal({ farmland, cropList = [], onClose }) {
  const [tab, setTab] = useState('seasons');
  const [seasons, setSeasons] = useState(null);
  const [operations, setOperations] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [seasonForm, setSeasonForm] = useState({
    seasonName: '',
    cropId: farmland?.cropId ? String(farmland.cropId) : '',
    plantDate: '',
    expectedHarvestDate: '',
    harvestDate: '',
    status: 'PLANTED',
    notes: '',
  });
  const [opForm, setOpForm] = useState({
    operationType: '施肥',
    operationDate: today(),
    detail: '',
    fertilizer: '',
    pesticide: '',
    operator: '',
    notes: '',
  });

  const cropName = (id) => cropList.find((crop) => crop.id === id)?.cropName || '未选择作物';

  const load = async () => {
    setError('');
    try {
      if (tab === 'seasons') setSeasons(await farmlandApi.seasons.list(farmland.id));
      else setOperations(await farmlandApi.farmOperations.list(farmland.id));
    } catch (e) {
      setError(e.message || '加载失败');
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
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submitSeason = async (event) => {
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
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const submitOperation = async (event) => {
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
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const removeSeason = async (id) => {
    if (!window.confirm('删除这条季节记录？')) return;
    try {
      await farmlandApi.seasons.remove(farmland.id, id);
      await load();
    } catch (e) {
      setError(e.message || '删除失败');
    }
  };

  const removeOperation = async (id) => {
    if (!window.confirm('删除这条农事记录？')) return;
    try {
      await farmlandApi.farmOperations.remove(farmland.id, id);
      await load();
    } catch (e) {
      setError(e.message || '删除失败');
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
        </div>

        {error && <div className="auth-error">{error}</div>}

        {tab === 'seasons' ? (
          <>
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
                        </span>
                      </div>
                      <span className={`records-status ${season.status?.toLowerCase()}`}>
                        {SEASON_STATUS[season.status] || season.status}
                      </span>
                      <button type="button" className="records-danger" onClick={() => removeSeason(season.id)}>
                        删除
                      </button>
                    </div>
                  ))}
            </div>
          </>
        ) : (
          <>
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