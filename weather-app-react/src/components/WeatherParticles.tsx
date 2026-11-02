import { useEffect, useRef } from 'react';

const PARTICLE_CONFIGS = {
  sunny: { type: 'sun', count: 30, color: '255, 220, 100', speed: 0.3, size: 2 },
  cloudy: { type: 'fog', count: 20, color: '255, 255, 255', speed: 0.15, size: 40 },
  rainy: { type: 'rain', count: 60, color: '180, 210, 255', speed: 8, size: 1 },
  snowy: { type: 'snow', count: 50, color: '255, 255, 255', speed: 0.8, size: 3 },
  thunder: { type: 'rain', count: 80, color: '200, 210, 240', speed: 10, size: 1.2 },
  night: { type: 'star', count: 40, color: '255, 255, 255', speed: 0.1, size: 1.2 },
  default: { type: 'none' },
};

export default function WeatherParticles({ weatherCode }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const config = PARTICLE_CONFIGS[weatherCode] || PARTICLE_CONFIGS.default;
    if (config.type === 'none') return;

    let particles = [];
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    function createParticle() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: config.size * (0.5 + Math.random()),
        speed: config.speed * (0.5 + Math.random()),
        opacity: 0.3 + Math.random() * 0.5,
        wind: (Math.random() - 0.5) * 0.6,
      };
    }

    particles = Array.from({ length: config.count }, createParticle);

    function drawRain(p) {
      ctx.strokeStyle = `rgba(${config.color}, ${p.opacity})`;
      ctx.lineWidth = p.r * 0.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.wind * 3, p.y + p.r * 12);
      ctx.stroke();
    }

    function drawSnow(p) {
      ctx.fillStyle = `rgba(${config.color}, ${p.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${config.color}, ${p.opacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawSunRay(p) {
      ctx.fillStyle = `rgba(${config.color}, ${p.opacity * 0.15})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawFog(p) {
      ctx.fillStyle = `rgba(${config.color}, ${p.opacity * 0.08})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawStar(p) {
      const flicker = 0.5 + Math.sin(Date.now() * 0.003 + p.x) * 0.5;
      ctx.fillStyle = `rgba(${config.color}, ${p.opacity * flicker})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawMap = {
      rain: drawRain,
      snow: drawSnow,
      sun: drawSunRay,
      fog: drawFog,
      star: drawStar,
    };

    const drawFn = drawMap[config.type];

    function animate() {
      ctx.clearRect(0, 0, w, h);

      particles.forEach((p) => {
        if (config.type === 'rain') {
          p.y += p.speed;
          p.x += p.wind;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        } else if (config.type === 'snow') {
          p.y += p.speed * 0.6;
          p.x += Math.sin(p.y * 0.02) * 0.5 + p.wind * 0.3;
          if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        } else if (config.type === 'sun' || config.type === 'star') {
          p.y += p.speed * 0.2;
          p.x += p.wind * 0.2;
          if (p.y > h + 10 || p.y < -10) { p.y = Math.random() * h; p.x = Math.random() * w; }
        } else if (config.type === 'fog') {
          p.x += p.wind * 0.3;
          if (p.x > w + 60) { p.x = -60; p.y = Math.random() * h; }
          if (p.x < -60) { p.x = w + 60; }
        }

        drawFn(p);
      });

      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [weatherCode]);

  return <canvas id="particles" ref={canvasRef} />;
}
