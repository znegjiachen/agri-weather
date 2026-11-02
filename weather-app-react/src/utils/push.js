import { push as pushApi } from '../api';

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** 查询当前浏览器 / 服务端的推送可用状态 */
export async function getPushStatus() {
  if (!pushSupported()) return { state: 'unsupported' };

  let config;
  try {
    config = await pushApi.publicKey();
  } catch {
    return { state: 'error' };
  }
  if (!config?.enabled || !config.publicKey) return { state: 'server-disabled' };
  if (Notification.permission === 'denied') return { state: 'denied' };

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return { state: 'unavailable' };
  const subscription = await registration.pushManager.getSubscription();
  if (Notification.permission === 'granted' && subscription) {
    return { state: 'subscribed', subscription, publicKey: config.publicKey };
  }
  return { state: 'available', publicKey: config.publicKey };
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('当前浏览器不支持 Web Push');
  const config = await pushApi.publicKey();
  if (!config?.enabled || !config.publicKey) {
    throw new Error('服务端未配置推送密钥');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('未获得通知权限');

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw new Error('页面尚未启用离线服务，请刷新后重试');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  const json = subscription.toJSON();
  await pushApi.subscribe({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    userAgent: navigator.userAgent,
  });
  return { state: 'subscribed', subscription };
}

export async function disablePush() {
  if (!pushSupported()) return { state: 'unsupported' };
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return { state: 'unavailable' };
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    try {
      await pushApi.unsubscribe(subscription.endpoint);
    } catch {
      // 后端不可用时仍然解除本机订阅
    }
    await subscription.unsubscribe();
  }
  return { state: 'available' };
}