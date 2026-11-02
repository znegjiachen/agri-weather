import { Component } from 'react';

/** 渲染异常兜底：避免任一组件报错导致整页白屏 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('页面渲染异常:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error-fallback">
          <div className="app-error-emoji" aria-hidden>🌾</div>
          <h2>页面出了点问题</h2>
          <p>可以刷新页面重试；如果问题持续出现，请把当前操作反馈给管理员。</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}