export default function LoadingSpinner() {
  return (
    <div className="loading">
      <div className="spinner-container">
        <div className="spinner"></div>
        <div className="spinner-inner"></div>
      </div>
      <p>正在获取天气数据...</p>
    </div>
  );
}
