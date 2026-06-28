const MAIL_URL = (window.__SDB_MAIL_URL ?? 'http://localhost:3004').replace(/\/$/, '');

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw], (c) => c.charCodeAt(0));
}

async function fetchVapidPublicKey() {
  if (window.__VAPID_PUBLIC_KEY) return window.__VAPID_PUBLIC_KEY;
  const res = await fetch(`${MAIL_URL}/mail/push/vapid-public-key`);
  if (!res.ok) return null;
  const body = await res.json();
  return body.publicKey ?? null;
}

export async function subscribeWeeklyReminder(accessToken) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Notifications are not supported on this device or browser');
  }

  const vapidKey = await fetchVapidPublicKey();
  if (!vapidKey) {
    throw new Error('Push reminders are not configured on the server yet');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied');
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const json = sub.toJSON();
  const res = await fetch(`${MAIL_URL}/mail/push/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription: {
        endpoint: json.endpoint,
        keys: json.keys,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Failed to register for reminders');
  }

  return true;
}

export async function unsubscribeWeeklyReminder(accessToken) {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();

  await fetch(`${MAIL_URL}/mail/push/unsubscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ all: true }),
  });

  if (sub) await sub.unsubscribe();
}

export function maybeShowLocalWeeklyReminder(enabled, weekStartForFn) {
  if (!enabled || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  const nz = new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }));
  if (nz.getDay() !== 0 || nz.getHours() < 15) return;

  const y = nz.getFullYear();
  const m = String(nz.getMonth() + 1).padStart(2, '0');
  const d = String(nz.getDate()).padStart(2, '0');
  const weekKey = weekStartForFn(`${y}-${m}-${d}`);
  const last = localStorage.getItem('timesheet_local_reminder_week');
  if (last === weekKey) return;

  navigator.serviceWorker.ready.then((reg) =>
    reg.showNotification('Timesheet App', {
      body: 'Reminder: check your hours for this week.',
      tag: 'weekly-reminder',
      data: { url: '/' },
    }),
  );
  localStorage.setItem('timesheet_local_reminder_week', weekKey);
}
