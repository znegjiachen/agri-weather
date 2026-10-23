import { Link } from 'react-router-dom';
import { SUB_NAV } from '../nav';

/** 首页功能入口：把原来侧边栏的 5 个页面收进来 */
export default function FeatureGrid() {
  return (
    <section className="feature-section">
      <h3 className="feature-title">功能入口</h3>
      <div className="feature-grid">
        {SUB_NAV.map((item) => (
          <Link key={item.to} to={item.to} className="feature-item glass">
            <span className="feature-icon">{item.icon}</span>
            <span className="feature-label">{item.label}</span>
            <span className="feature-desc">{item.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
