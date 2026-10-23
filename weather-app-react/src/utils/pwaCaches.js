/**
 * 清除带用户身份的 API 缓存。
 * 登出或切换账号时调用，避免下一位登录者离线看到上一位用户的数据。
 */
export async function clearApiCache() {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k === 'api-get').map((k) => caches.delete(k)),
    );
  } catch {
    // 缓存不可用不影响主流程
  }
}
