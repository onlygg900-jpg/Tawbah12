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

export function showNotification(title: string, body: string, tag?: string): void {
  if (!notificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: tag || 'tawbah-' + Date.now(),
    });
  } catch {
    // ignore
  }
}

let audioCtx: AudioContext | null = null;
function beep(duration = 200, freq = 800, vol = 0.3): void {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
    }
    const ctx = audioCtx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
    }, duration);
  } catch {
    // ignore audio errors
  }
}

export function playAdhanSound(): void {
  const pattern = [
    { d: 400, f: 523 },
    { d: 300, f: 0 },
    { d: 400, f: 659 },
    { d: 300, f: 0 },
    { d: 600, f: 784 },
    { d: 500, f: 0 },
    { d: 400, f: 659 },
    { d: 300, f: 0 },
    { d: 400, f: 523 },
    { d: 300, f: 0 },
    { d: 600, f: 587 },
  ];
  let delay = 0;
  for (const note of pattern) {
    setTimeout(() => {
      if (note.f > 0) beep(note.d, note.f, 0.25);
    }, delay);
    delay += note.d + 80;
  }
}

export function notifyPrayer(prayerName: string): void {
  playAdhanSound();
  const d = getRandomDhikr();
  showNotification(
    `🕌 حان وقت صلاة ${prayerName}`,
    `قم بالصلاة في وقتها للحصول على الأجر الكامل\n\n${d.text}\n— ${d.source}`,
    `prayer-${prayerName}-${Date.now()}`
  );
}

export function notifyDhikr(category: 'morning' | 'evening' | 'afterPrayer' | 'daily' | 'periodic'): void {
  const map = {
    morning: { title: '🌅 أذكار الصباح', fn: () => import('./dhikrService').then((m) => m.getMorningDhikr()) },
    evening: { title: '🌆 أذكار المساء', fn: () => import('./dhikrService').then((m) => m.getEveningDhikr()) },
    afterPrayer: { title: '🤲 أذكار بعد الصلاة', fn: () => import('./dhikrService').then((m) => m.getAfterPrayerDhikr()) },
    daily: { title: '✨ حديث اليوم', fn: () => import('./dhikrService').then((m) => m.getDailyHadith()) },
    periodic: { title: '💭 تذكير بالذكر', fn: () => Promise.resolve(getRandomDhikr()) },
  } as const;
  const entry = map[category];
  entry.fn().then((d) => {
    beep(150, 660, 0.15);
    showNotification(entry.title, `${d.text}\n— ${d.source}`, `dhikr-${category}-${Date.now()}`);
  });
}

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
  check();
  timer = window.setInterval(check, 30000);
  return () => {
    if (timer) clearInterval(timer);
  };
}

export function schedulePeriodicDhikr(enabled: boolean, minMin = 10, maxMin = 15): () => void {
  let timer: number | undefined;
  const tick = () => {
    if (!enabled) return;
    if (typeof document !== 'undefined' && document.hidden === false) {
      notifyDhikr('periodic');
    } else if (notificationSupported() && Notification.permission === 'granted') {
      notifyDhikr('periodic');
    }
    const randomMin = minMin + Math.floor(Math.random() * (maxMin - minMin + 1));
    const nextDelay = randomMin * 60 * 1000;
    timer = window.setTimeout(tick, nextDelay);
  };
  const initialDelay = (minMin + Math.floor(Math.random() * (maxMin - minMin))) * 60 * 1000;
  timer = window.setTimeout(tick, initialDelay);
  return () => {
    if (timer) clearTimeout(timer);
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
