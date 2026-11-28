// Phone alerts (Web Push): turn on, turn off, test.
import { rpc } from './api.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const toBytes = (b64) => {
  const p = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};

async function publicKey() {
  let k = await rpc('push_public_key').catch(() => null);
  if (!k) {        // first time: the notify function creates the key pair and returns the public half
    const r = await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init' }),
    });
    if (!r.ok) throw new Error('The notify function is not set up yet');
    k = (await r.json()).public_key;
  }
  return k;
}

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser cannot show app notifications');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications were not allowed. Allow them in the site settings.');
  const reg = await navigator.serviceWorker.ready;
  const key = await publicKey();
  let sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();                         // make sure it uses the current key
  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
  const j = sub.toJSON();
  await rpc('save_push_subscription', { p: { endpoint: j.endpoint, keys: j.keys, device: navigator.userAgent.slice(0, 120) } });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const { rest, enc } = await import('./api.js');
    await rest(`push_subscriptions?endpoint=eq.${enc(sub.endpoint)}`, { method: 'DELETE' }).catch(() => {});
    await sub.unsubscribe();
  }
}

export const sendTestAlert = () => rpc('send_test_alert');
