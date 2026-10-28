import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // prompt 而不是 autoUpdate：自动刷新可能打断正在进行的对话或发帖
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '问田 · 农事气象平台',
        short_name: '问田',
        description: '问田 · 地块管理、天气预报、灾害预警与 AI 助农手',
        lang: 'zh-CN',
        theme_color: '#667eea',
        background_color: '#f5f7ff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // 否则离线时 API 请求会拿到 index.html，前端 res.json() 直接崩
        navigateFallbackDenylist: [/^\/api\//, /^\/actuator\//],
        runtimeCaching: [
          {
            // 社区图片：CacheFirst。URL 带随机 publicId、内容永不变，适合长缓存
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              url.pathname.startsWith('/api/community/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'community-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              url.origin === self.location.origin &&
              url.pathname.startsWith('/api/') &&
              request.method === 'GET' &&
              // 登录态与智能体对话不缓存
              !url.pathname.startsWith('/api/auth/') &&
              !url.pathname.startsWith('/api/agent/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-get',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 60, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
              plugins: [
                {
                  // 安全红线：Workbox 默认只按 URL 做缓存键，不区分 Authorization。
                  // 不拼 token 指纹的话，同一浏览器换账号会读到上一位用户的私有数据。
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const auth = request.headers.get('Authorization') || 'anon';
                    const buf = await crypto.subtle.digest(
                      'SHA-256',
                      new TextEncoder().encode(auth),
                    );
                    const hash = Array.from(new Uint8Array(buf))
                      .slice(0, 6)
                      .map((b) => b.toString(16).padStart(2, '0'))
                      .join('');
                    const url = new URL(request.url);
                    url.searchParams.set('__u', hash);
                    return new Request(url.toString(), { headers: request.headers });
                  },
                },
              ],
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://api.open-meteo.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'open-meteo',
              expiration: { maxEntries: 30, maxAgeSeconds: 6 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],

  // 生产构建的 API 走同源 /api（见 .env.production），
  // preview 下需要代理，才能在本地验证 Service Worker 的离线能力
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8082', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: 'http://localhost:8082', changeOrigin: true },
    },
  },
})
