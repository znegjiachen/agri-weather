import { useState, useEffect } from 'react';
import { crops, alerts, farmlands } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [cropList, setCropList] = useState([]);
  const [alertList, setAlertList] = useState([]);
  const [farmlandList, setFarmlandList] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    crops.list().then(setCropList).catch(() => {});
    alerts.list().then((d) => { setAlertList(d.slice(0, 5)); }).catch(() => {});
    alerts.unreadCount().then(setUnread).catch(() => {});
    farmlands.list().then(setFarmlandList).catch(() => {});
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome glass">
        <h2>👨‍🌾 欢迎，{user?.username}</h2>
        <p>{user?.region || '问田 · 农事气象服务平台'}</p>
      </div>

      <div className="stats-row">
        <div className="stat-card glass">
          <div className="stat-num">{cropList.length}</div>
          <div className="stat-label">作物种类</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-num">{farmlandList.length}</div>
          <div className="stat-label">我的地块</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-num" style={{ color: unread > 0 ? '#ef4444' : '#22c55e' }}>{unread}</div>
          <div className="stat-label">未读预警</div>
        </div>
      </div>

      <div className="grid-2col">
        <div className="glass section-card">
          <h3>🌱 可种植作物</h3>
          <div className="crop-chips">
            {cropList.map((c) => (
              <span key={c.id} className="crop-chip">{c.cropName}</span>
            ))}
          </div>
        </div>

        <div className="glass section-card">
          <h3>⚠️ 最近预警</h3>
          {alertList.length === 0 ? (
            <p className="empty-text">暂无预警信息</p>
          ) : (
            <div className="alert-mini-list">
              {alertList.map((a) => (
                <div key={a.id} className={`alert-mini level-${a.alertLevel?.toLowerCase()}`}>
                  <span className="alert-type-tag">{a.alertType}</span>
                  <span>{a.alertContent?.substring(0, 30)}...</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
