import { useState, useEffect } from 'react';
import { pests } from '../api';

const TYPE_NAMES = { INSECT: '🐛 虫害', FUNGUS: '🍄 病害' };

export default function PestPage() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => { pests.list().then(setList).catch(() => {}); }, []);

  const filtered = filter ? list.filter((p) => p.pestType === filter) : list;

  return (
    <div className="pest-page">
      <h2 className="page-title">🐛 病虫害气象预警知识库</h2>

      <div className="filter-bar">
        <button className={!filter ? 'active' : ''} onClick={() => setFilter('')}>全部</button>
        <button className={filter === 'INSECT' ? 'active' : ''} onClick={() => setFilter('INSECT')}>🐛 虫害</button>
        <button className={filter === 'FUNGUS' ? 'active' : ''} onClick={() => setFilter('FUNGUS')}>🍄 病害</button>
      </div>

      <div className="pest-grid">
        {filtered.map((p) => (
          <div key={p.id} className="pest-card glass">
            <h4>{p.pestName}</h4>
            <span className="pest-type-tag">{TYPE_NAMES[p.pestType] || p.pestType}</span>
            <div className="pest-triggers">
              <p>🌡️ 诱发温度：{p.triggerTempMin}°C ~ {p.triggerTempMax}°C</p>
              <p>💧 诱发湿度：{p.triggerHumidityMin}% ~ {p.triggerHumidityMax}%</p>
              {p.triggerRainDays > 0 && <p>🌧️ 连续降雨 {p.triggerRainDays} 天以上易发</p>}
            </div>
            {p.highRiskStages && <p className="pest-stages">⚠️ 高危阶段：{p.highRiskStages}</p>}
            <div className="pest-methods">
              <p><strong>预防：</strong>{p.prevention}</p>
              <p><strong>治疗：</strong>{p.controlMethod}</p>
            </div>
            {p.recommendedPesticide && (
              <p className="pest-pesticide">💊 推荐药剂：{p.recommendedPesticide}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
