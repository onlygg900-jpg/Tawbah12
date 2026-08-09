import type { NotificationSettings } from '@/types';
import { getRandomDhikr } from './dhikrService';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function showNotification(title: string, body: string): void {
  if (!notificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'tawbah-' + Date.now(),
    });
  } catch {
    // ignore
  }
}

export function notifyPrayer(prayerName: string): void {
  const d = getRandomDhikr();
  showNotification(`حان وقت صلاة ${prayerName}`, `${d.text}\n— ${d.source}`);
}

export function notifyDhikr(category: 'morning' | 'evening' | 'afterPrayer' | 'daily'): void {
  const map = {
    morning: { title: 'أذكار الصباح', fn: () => import('./dhikrService').then((m) => m.getMorningDhikr()) },
    evening: { title: 'أذكار المساء', fn: () => import('./dhikrService').then((m) => m.getEveningDhikr()) },
    afterPrayer: { title: 'أذكار بعد الصلاة', fn: () => import('./dhikrService').then((m) => m.getAfterPrayerDhikr()) },
    daily: { title: 'حديث اليوم', fn: () => import('./dhikrService').then((m) => m.getDailyHadith()) },
  } as const;
  const entry = map[category];
  entry.fn().then((d) => showNotification(entry.title, d.text));
}

// Schedule periodic checks against prayer times
export function schedulePrayerChecks(
  getPrayers: () => Array<{ key: string; label: string; time: string }>,
  enabled: boolean
): () => void {
  const notified = new Set<string>();
  let timer: number | undefined;
  const check = () => {
    if (!enabled) return;
    const now = new Date();
    const key = `${now.toISOString().slice(0, 10)}`;
    const prayers = getPrayers();
    for (const p of prayers) {
      const [h, m] = p.time.split(':').map(Number);
      if (now.getHours() === h && now.getMinutes() === m) {
        const id = `${key}-${p.key}`;
        if (!notified.has(id)) {
          notified.add(id);
          notifyPrayer(p.label);
        }
      }
    }
  };
  timer = window.setInterval(check, 30000);
  return () => {
    if (timer) clearInterval(timer);
  };
}

export function describePermission(p: NotificationPermission): string {
  return p === 'granted' ? 'مفعّل' : p === 'denied' ? 'مرفوض' : 'لم يُحدّد بعد';
}

export function defaultNotificationSettings(): NotificationSettings {
  return {
    enabled: false,
    morningAdhkar: true,
    eveningAdhkar: true,
    afterPrayerAdhkar: true,
    dailyHadith: true,
    prayerReminders: true,
  };
}
