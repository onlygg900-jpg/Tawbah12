import type { PrayerInfo, PrayerKey, PrayerTracking } from '@/types';
import { todayKey } from './storage';

const API_BASE = import.meta.env.VITE_ALADHAN_API_BASE || 'https://api.aladhan.com/v1';

export const PRAYER_KEYS: PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

export const PRAYER_ICONS: Record<PrayerKey, string> = {
  Fajr: '🌅',
  Dhuhr: '☀️',
  Asr: '🌤️',
  Maghrib: '🌇',
  Isha: '🌙',
};

export interface TimingsResponse {
  data: {
    timings: Record<string, string>;
    date: { readable: string; hijri: { date: string; month: { ar: string }; year: string } };
    meta: { latitude: number; longitude: number; timezone: string };
  };
}

function cleanTime(t: string): string {
  return t.slice(0, 5);
}

export interface LocationCoords {
  lat: number;
  lng: number;
  source: 'gps' | 'ip' | 'manual';
  label?: string;
}

export async function fetchPrayerTimes(
  city: string,
  country: string,
  method = 4
): Promise<{ prayers: PrayerInfo[]; hijriDate: string; readableDate: string }> {
  const url = `${API_BASE}/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`تعذّر جلب المواقيت (${res.status})`);
  const json: TimingsResponse = await res.json();
  return parseTimingsResponse(json);
}

export async function fetchPrayerTimesByCoords(
  lat: number,
  lng: number,
  method = 5
): Promise<{ prayers: PrayerInfo[]; hijriDate: string; readableDate: string }> {
  const url = `${API_BASE}/timings?latitude=${lat}&longitude=${lng}&method=${method}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`تعذّر جلب المواقيت (${res.status})`);
  const json: TimingsResponse = await res.json();
  return parseTimingsResponse(json);
}

function parseTimingsResponse(json: TimingsResponse): {
  prayers: PrayerInfo[];
  hijriDate: string;
  readableDate: string;
} {
  const t = json.data.timings;
  const prayers: PrayerInfo[] = PRAYER_KEYS.map((key) => ({
    key,
    label: PRAYER_LABELS[key],
    time: cleanTime(t[key] || '00:00'),
  }));
  const h = json.data.date.hijri;
  const hijriDate = `${h.date} ${h.month.ar} ${h.year} هـ`;
  return { prayers, hijriDate, readableDate: json.data.date.readable };
}

const IP_GEO_API = 'https://ipapi.co/json/';

export async function detectLocationByIP(): Promise<LocationCoords | null> {
  try {
    const res = await fetch(IP_GEO_API);
    if (!res.ok) return null;
    const json: { latitude?: number; longitude?: number; city?: string; country_name?: string } = await res.json();
    if (typeof json.latitude === 'number' && typeof json.longitude === 'number') {
      return {
        lat: json.latitude,
        lng: json.longitude,
        source: 'ip',
        label: `${json.city || ''} ${json.country_name || ''}`.trim() || 'موقعك',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function detectGPSLocation(): Promise<LocationCoords | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

export async function detectLocation(): Promise<LocationCoords> {
  const gps = await detectGPSLocation();
  if (gps) return gps;
  const ip = await detectLocationByIP();
  if (ip) return ip;
  return { lat: 30.0444, lng: 31.2357, source: 'manual', label: 'القاهرة، مصر' };
}

export function emptyTracking(): PrayerTracking {
  const base = { date: todayKey() } as PrayerTracking;
  for (const k of PRAYER_KEYS) base[k] = 'missed';
  return base;
}

export function findNextPrayer(prayers: PrayerInfo[]): { prayer: PrayerInfo; isNext: boolean } | null {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const p of prayers) {
    const [h, m] = p.time.split(':').map(Number);
    const pMin = h * 60 + m;
    if (pMin > nowMin) return { prayer: p, isNext: true };
  }
  // after Isha -> next is Fajr tomorrow
  return { prayer: prayers[0], isNext: false };
}

export function timeUntil(time: string): { hours: number; minutes: number; label: string } {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [h, m] = time.split(':').map(Number);
  let target = h * 60 + m;
  if (target <= nowMin) target += 24 * 60;
  const diff = target - nowMin;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  const label = hours > 0 ? `${hours} ساعة و ${minutes} دقيقة` : `${minutes} دقيقة`;
  return { hours, minutes, label };
}
