import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeWeather from '../components/HomeWeather';

const SLIDES = [
  {
    to: '/home/weather',
    kicker: '智慧农事 · 气象护航',
    title: '天气与农事一站管理',
    desc: '实时天气、灾害预警、地块信息',
    icon: '🌦️',
    tone: 'green',
  },
  {
    to: '/agent',
    kicker: 'AI 农事顾问',
    title: '助农手随时在线',
    desc: '病虫害、施肥、打药都能问',
    icon: '🤖',
    tone: 'blue',
  },
  {
    to: '/home/map',
    kicker: '地块管理',
    title: '在地图上管理每一块田',
    desc: '查看地块分布与作物档案',
    icon: '🗺️',
    tone: 'orange',
  },
];

const FEATURES = [
  { to: '/community', icon: '💬', title: '社区', desc: '看看大家怎么说' },
  { to: '/home/crops', icon: '🌱', title: '作物适配', desc: '选对作物与品种' },
  { to: '/home/pests', icon: '🐛', title: '病虫害库', desc: '症状与防治方案' },
];

const AGENTS = [
  {
    to: '/agent',
    avatar: '👨‍🌾',
    title: '助农手',
    desc: '可以回答您的农业问题，提供种植、天气与地块建议。',
  },
  {
    to: '/home/pests',
    avatar: '🔍',
    title: '病虫害问诊',
    desc: '识别作物病害、虫害、缺素等问题，提供排查与防治建议。',
  },
];

export default function MobileHome() {
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const onTouchStart = (event) => {
    touchX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event) => {
    if (touchX.current == null) return;
    const dx = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    if (Math.abs(dx) > 40) {
      setIndex((i) => (i + (dx < 0 ? 1 : SLIDES.length - 1)) % SLIDES.length);
    }
    touchX.current = null;
  };

  return (
    <div className="mobile-home">
      <HomeWeather />

      <div
        className="mh-carousel"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="mh-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {SLIDES.map((slide) => (
            <Link key={slide.to} to={slide.to} className={`mh-slide tone-${slide.tone}`}>
              <div className="mh-slide-text">
                <span className="mh-slide-kicker">{slide.kicker}</span>
                <h3>{slide.title}</h3>
                <p>{slide.desc}</p>
              </div>
              <span className="mh-slide-icon" aria-hidden>{slide.icon}</span>
            </Link>
          ))}
        </div>
        <div className="mh-dots">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.to}
              type="button"
              className={i === index ? 'active' : ''}
              onClick={() => setIndex(i)}
              aria-label={`切换到第 ${i + 1} 张`}
            />
          ))}
        </div>
      </div>

      <Link to="/agent" className="mh-hero">
        <div className="mh-hero-top">
          <span className="mh-hero-avatar" aria-hidden>👨‍🌾</span>
          <span className="mh-hero-tag">农业新质生产力</span>
        </div>
        <h2>Hello~</h2>
        <p className="mh-hero-sub">我是助农手，你的专属农事助手</p>
        <div className="mh-hero-cta">
          <span>点击此处向我提问，任何农业问题都可以</span>
          <span aria-hidden>→</span>
        </div>
      </Link>

      <div className="mh-mosaic">
        <Link to="/home/map" className="mh-feature mh-feature-large">
          <span className="mh-feature-tag">农事信息索引</span>
          <h3>农事地图</h3>
          <p>一键查看地块分布</p>
          <span className="mh-feature-art" aria-hidden>🗺️</span>
        </Link>

        {FEATURES.map((feature) => (
          <Link key={feature.to} to={feature.to} className="mh-feature">
            <div className="mh-feature-text">
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
            <span className="mh-feature-emoji" aria-hidden>{feature.icon}</span>
          </Link>
        ))}
      </div>

      <div className="mh-section-head">
        <h3>热门智能体</h3>
        <Link to="/agent" className="mh-more">更多 ›</Link>
      </div>

      <div className="mh-agents">
        {AGENTS.map((agent) => (
          <Link key={agent.to} to={agent.to} className="mh-agent">
            <span className="mh-agent-avatar" aria-hidden>{agent.avatar}</span>
            <div className="mh-agent-body">
              <h4>{agent.title}</h4>
              <p>{agent.desc}</p>
            </div>
            <span className="mh-agent-arrow" aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}