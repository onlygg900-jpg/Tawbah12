import { useEffect, useState, useCallback, useRef } from 'react';
import { MapPin, RefreshCw, Bell, Sparkles, Heart } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fetchPrayerTimes, fetchPrayerTimesByCoords, PRAYER_ICONS, findNextPrayer, timeUntil } from '@/services/prayerService';
import type { PrayerInfo, PrayerKey, PrayerStatus } from '@/types';
import { SectionCard, ErrorBanner, LoadingSpinner } from '@/components/ui';
import { requestNotificationPermission, describePermission, notifyDhikr } from '@/services/notificationService';
import { getDailyHadith } from '@/services/dhikrService';
import QiblaCompass from '@/components/home/QiblaCompass';
import TasbeehCounter from '@/components/home/TasbeehCounter';

const STATUS_META: Record<PrayerStatus, { label: string; color: string }> = {
  on_time: { label: 'صليت في وقتها', color: 'bg-emerald text-white' },
  late: { label: 'صليت متأخراً', color: 'bg-gold text-white' },
  missed: { label: 'فاتتني', color: 'bg-red-500 text-white' },
};

export default function HomeView() {
  const { settings, tracking, setPrayerStatus, setPrayers, prayers, location } = useApp();
  const [prayerList, setPrayerList] = useState<PrayerInfo[]>([]);
  const [hijriDate, setHijriDate] = useState('');
  const [readableDate, setReadableDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [dailyHadith, setDailyHadith] = useState(getDailyHadith());
  const hadithRef = useRef(getDailyHadith());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (location && location.source === 'gps') {
        data = await fetchPrayerTimesByCoords(location.lat, location.lng, settings.calcMethod);
      } else if (location && location.source === 'ip') {
        data = await fetchPrayerTimesByCoords(location.lat, location.lng, settings.calcMethod);
      } else {
        data = await fetchPrayerTimes(settings.city, settings.country, settings.calcMethod);
      }
      setPrayerList(data.prayers);
      setHijriDate(data.hijriDate);
      setReadableDate(data.readableDate);
      setPrayers(data.prayers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [settings.city, settings.country, settings.calcMethod, setPrayers, location]);

  useEffect(() => {
    load();
  }, [load]);

  // refresh daily hadith once per day
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem('tawbah:hadith-day');
    if (last !== todayKey) {
      const h = getDailyHadith();
      hadithRef.current = h;
      setDailyHadith(h);
      localStorage.setItem('tawbah:hadith-day', todayKey);
    }
  }, []);

  const next = prayerList.length ? findNextPrayer(prayerList) : null;
  const nextInfo = next ? timeUntil(next.prayer.time) : null;

  const handleEnableNotifs = async () => {
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === 'granted') {
      notifyDhikr('daily');
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald to-emerald-deep p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">توبة</h1>
            <p className="text-emerald-100 text-sm">رفيقك الروحي اليومي</p>
          </div>
          <div className="text-left">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <MapPin size={14} /> {settings.city}
            </p>
            <p className="text-xs text-emerald-100">{readableDate}</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-white/10 px-3 py-2">
          <p className="text-sm font-semibold text-gold-light">{hijriDate || '—'}</p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Next prayer countdown */}
      {loading ? (
        <LoadingSpinner label="جارٍ جلب مواقيت الصلاة..." />
      ) : prayerList.length > 0 ? (
        <>
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-l from-gold/15 to-transparent p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">الصلاة القادمة</p>
              {next && nextInfo ? (
                <div className="mt-1 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-extrabold text-emerald dark:text-gold-light">
                      {PRAYER_ICONS[next.prayer.key]} {next.prayer.label}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{next.prayer.time}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400">متبقٍ</p>
                    <p className="text-lg font-bold text-emerald dark:text-gold-light">{nextInfo.label}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm">لا توجد بيانات</p>
              )}
            </div>
            <div className="grid grid-cols-5 divide-x divide-x-reverse divide-slate-100 dark:divide-emerald-soft/30 border-t border-slate-100 dark:border-emerald-soft/30">
              {prayerList.map((p) => (
                <div key={p.key} className="px-1 py-3 text-center">
                  <p className="text-lg">{PRAYER_ICONS[p.key]}</p>
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{p.label}</p>
                  <p className="text-xs font-bold text-emerald dark:text-gold-light">{p.time}</p>
                </div>
              ))}
            </div>
            <button onClick={load} className="w-full border-t border-slate-100 dark:border-emerald-soft/30 py-2 text-xs font-semibold text-slate-500 hover:text-emerald flex items-center justify-center gap-1">
              <RefreshCw size={12} /> تحديث المواقيت
            </button>
          </div>

          {/* Prayer tracker */}
          <SectionCard title="متتبع الصلوات" icon={<Heart size={18} />}>
            <div className="space-y-2.5">
              {prayerList.map((p) => (
                <PrayerTrackerRow
                  key={p.key}
                  prayerKey={p.key}
                  label={p.label}
                  time={p.time}
                  status={tracking[p.key]}
                  onSet={(s) => setPrayerStatus(p.key, s)}
                />
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}

      {/* Daily hadith */}
      <SectionCard title="حديث اليوم" icon={<Sparkles size={18} />} className="border-gold/30 bg-gold/5">
        <p className="quran-text text-lg leading-loose text-slate-800 dark:text-slate-100">{dailyHadith.text}</p>
        <p className="mt-2 text-xs font-semibold text-gold-dark dark:text-gold-light">— {dailyHadith.source}</p>
      </SectionCard>

      {/* Notification prompt */}
      {notifPerm !== 'granted' && (
        <SectionCard title="تفعيل التنبيهات" icon={<Bell size={18} />}>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            فعّل التنبيهات لتذكيرك بمواقيت الصلاة والأذكار اليومية. الحالة الحالية: {describePermission(notifPerm)}
          </p>
          <button onClick={handleEnableNotifs} className="btn-gold w-full">
            <Bell size={16} /> السماح بالإشعارات
          </button>
        </SectionCard>
      )}

      {/* Qibla + Tasbeeh */}
      <div className="grid gap-4 sm:grid-cols-2">
        <QiblaCompass />
        <TasbeehCounter />
      </div>
    </div>
  );
}

interface PrayerTrackerRowProps {
  prayerKey: PrayerKey;
  label: string;
  time: string;
  status: PrayerStatus;
  onSet: (s: PrayerStatus) => void;
}

function PrayerTrackerRow({ label, time, status, onSet }: PrayerTrackerRowProps) {
  const statuses: PrayerStatus[] = ['on_time', 'late', 'missed'];
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 dark:bg-emerald-deep/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{PRAYER_ICONS[
          label as keyof typeof PRAYER_ICONS
        ] || '🕌'}</span>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{time}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onSet(s)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
              status === s ? STATUS_META[s].color : 'bg-white dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-emerald-soft/40'
            }`}
          >
            {STATUS_META[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
