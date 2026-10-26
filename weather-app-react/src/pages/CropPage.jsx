import { useState, useEffect } from 'react';
import { crops } from '../api';

export default function CropPage() {
  const [cropList, setCropList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stages, setStages] = useState([]);
  const [match, setMatch] = useState(null);
  const [temp, setTemp] = useState(25);
  const [humidity, setHumidity] = useState(65);
  const [rainfall, setRainfall] = useState(10);
  const [light, setLight] = useState(8);

  useEffect(() => { crops.list().then(setCropList).catch(() => {}); }, []);

  const selectCrop = async (crop) => {
    setSelected(crop);
    const s = await crops.stages(crop.id).catch(() => []);
    setStages(s);
  };

  const checkMatch = async () => {
    if (!selected) return;
    const m = await crops.weatherMatch(selected.id, {
      temp, humidity, rainfall, light,
    }).catch(() => null);
    setMatch(m);
  };

  return (
    <div className="crop-page">
      <h2 className="page-title">🌱 作物气象适配</h2>

      <div className="grid-2col">
        <div className="glass section-card">
          <h3>选择作物</h3>
          <div className="crop-chips">
            {cropList.map((c) => (
              <span
                key={c.id}
                className={`crop-chip ${selected?.id === c.id ? 'active' : ''}`}
                onClick={() => selectCrop(c)}
              >
                {c.cropName}
              </span>
            ))}
          </div>

          {selected && (
            <div className="crop-detail">
              <h4>{selected.cropName}（{selected.variety}）</h4>
              <p>生长周期：{selected.growthCycleDays} 天</p>
              <p>适宜温度：{selected.suitableTempMin}°C ~ {selected.suitableTempMax}°C</p>
              <p>适宜湿度：{selected.suitableHumidityMin}% ~ {selected.suitableHumidityMax}%</p>
              <div className="tags">
                {selected.frostSensitive && <span className="tag tag-danger">❄️ 怕冻</span>}
                {selected.heatSensitive && <span className="tag tag-warning">🌡️ 怕热</span>}
                {selected.waterlogSensitive && <span className="tag tag-info">💧 怕涝</span>}
              </div>
            </div>
          )}
        </div>

        <div className="glass section-card">
          <h3>气象匹配检测</h3>
          <div className="match-form">
            <label>温度 (°C)<input type="number" value={temp} onChange={(e) => setTemp(+e.target.value)} /></label>
            <label>湿度 (%)<input type="number" value={humidity} onChange={(e) => setHumidity(+e.target.value)} /></label>
            <label>降水 (mm)<input type="number" value={rainfall} onChange={(e) => setRainfall(+e.target.value)} /></label>
            <label>光照 (h)<input type="number" value={light} onChange={(e) => setLight(+e.target.value)} /></label>
            <button onClick={checkMatch} disabled={!selected}>检测适配度</button>
          </div>

          {match && (
            <div className={`match-result score-${match.finalScore >= 80 ? 'good' : match.finalScore >= 60 ? 'warn' : 'bad'}`}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="match-score" style={{ fontSize: 48 }}>
                  {match.finalScore}
                  <span style={{ fontSize: 16, color: '#666' }}>分</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color:
                  match.finalGrade === '优秀' ? '#16a34a' : match.finalGrade === '良好' ? '#22c55e' : match.finalGrade === '一般' ? '#eab308' : '#ef4444'
                }}>
                  {match.finalGrade}
                </div>
              </div>

              {/* 各维度评分条 */}
              {['temperature','humidity','rainfall','light'].map(key => {
                const m = match[key];
                if (!m) return null;
                return (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                      <span>{key === 'temperature' ? '🌡️ 温度' : key === 'humidity' ? '💧 湿度' : key === 'rainfall' ? '🌧️ 降水' : '☀️ 光照'}（权重{m.weight}%）</span>
                      <span style={{ fontWeight: 600, color: m.score >= 85 ? '#16a34a' : m.score >= 70 ? '#22c55e' : m.score >= 50 ? '#eab308' : '#ef4444' }}>
                        {m.score}分 {m.label}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: m.score + '%', borderRadius: 3,
                        background: m.score >= 85 ? 'linear-gradient(90deg,#22c55e,#16a34a)' :
                                     m.score >= 70 ? 'linear-gradient(90deg,#84cc16,#22c55e)' :
                                     m.score >= 50 ? 'linear-gradient(90deg,#eab308,#f59e0b)' :
                                     'linear-gradient(90deg,#ef4444,#dc2626)',
                        transition: 'width 0.6s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>当前{m.current} | 适宜{m.range || m.reference}</div>
                  </div>
                );
              })}

              {/* 风险警告 */}
              {match.risks && match.risks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {match.risks.map((r, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 8, marginBottom: 6, fontSize: 13,
                      background: r.level === 'RED' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                      borderLeft: '3px solid ' + (r.level === 'RED' ? '#ef4444' : '#eab308')
                    }}>
                      <span style={{ fontWeight: 600, color: r.level === 'RED' ? '#dc2626' : '#b45309' }}>
                        {r.level === 'RED' ? '🔴' : '🟡'} {r.type}
                      </span> {r.msg}
                    </div>
                  ))}
                </div>
              )}

              {/* 建议 */}
              {match.suggestions && match.suggestions.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(102,126,234,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💡 农事建议</div>
                  {match.suggestions.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#555', padding: '3px 0' }}>• {s}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {stages.length > 0 && (
        <div className="glass section-card" style={{ marginTop: 16 }}>
          <h3>📋 {selected?.cropName} 生长阶段</h3>
          <div className="stages-timeline">
            {stages.map((s, i) => (
              <div key={s.id ?? `${s.stageOrder}-${i}`} className={`stage-item risk-${s.pestRiskLevel?.toLowerCase()}`}>
                <div className="stage-order">{s.stageOrder}</div>
                <div className="stage-name">{s.stageName}</div>
                <div className="stage-days">{s.stageDays}天</div>
                <div className="stage-temp">{s.tempMin}~{s.tempMax}°C</div>
                {s.keyWarnings && <div className="stage-warn">⚠️ {s.keyWarnings}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
