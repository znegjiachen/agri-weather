export default function ErrorPanel({ onRetry }) {
  return (
    <div className="error glass">
      <p>无法获取天气数据，请检查城市名称或网络连接。</p>
      <button className="retry-btn" onClick={onRetry}>重试</button>
    </div>
  );
}
