import type { Farmland, FarmlandAction } from '../types/farmland';

interface FarmlandCardProps {
  field: Farmland;
  cropName: string;
  stage?: string;
  days: number | null;
  onAction: (action: FarmlandAction) => void;
  onRecords: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** 地块管理中的单张地块卡：档案、阶段和常用操作 */
export default function FarmlandCard({
  field,
  cropName,
  stage,
  days,
  onAction,
  onRecords,
  onEdit,
  onDelete,
}: FarmlandCardProps) {
  return (
    <div className="farmland-card glass">
      <div className="farmland-header">
        <div className="farmland-title">
          <h3>{field.fieldName}</h3>
          <span className="crop-badge">{cropName}</span>
        </div>
        <div className="farmland-card-tools">
          <button
            type="button"
            className="fc-icon"
            onClick={onEdit}
            title="编辑地块"
            aria-label={`编辑地块 ${field.fieldName}`}
          >
            ✏️
          </button>
          <button
            type="button"
            className="fc-icon danger"
            onClick={onDelete}
            title="删除地块"
            aria-label={`删除地块 ${field.fieldName}`}
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="fc-stage-row">
        {field.cropId && field.plantDate ? (
          <>
            <span className="fc-stage">{stage || '阶段计算中'}</span>
            <span className="fc-days">已种植 {days ?? 0} 天</span>
          </>
        ) : field.cropId ? (
          <button type="button" className="fc-missing" onClick={onEdit}>
            未填播种日期 · 点击补充
          </button>
        ) : (
          <span className="fc-muted">未选择作物</span>
        )}
      </div>

      <div className="fc-detail-grid">
        <div>
          <span>位置</span>
          <b>
            {field.lat?.toFixed(2)}, {field.lng?.toFixed(2)}
            {field.altitude ? ` · ${field.altitude}m` : ''}
          </b>
        </div>
        <div><span>面积</span><b>{field.areaMu != null ? `${field.areaMu} 亩` : '未填'}</b></div>
        <div><span>土壤</span><b>{field.soilType || '未填'}</b></div>
        <div><span>灌溉</span><b>{field.irrigationType || '未填'}</b></div>
      </div>

      <div className="farmland-actions">
        <button className="fc-action" onClick={() => onAction('weather')}>
          🌤️ 天气
        </button>
        <button className="fc-action warn" onClick={() => onAction('alerts')}>
          ⚠️ 预警
        </button>
        <button className="fc-action" onClick={() => onAction('advice')}>
          📋 农事
        </button>
        <button className="fc-action" onClick={onRecords}>
          📒 记录
        </button>
      </div>
    </div>
  );
}
