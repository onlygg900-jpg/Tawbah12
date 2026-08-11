import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, RefreshCw, Bell, Volume2, VolumeX, Heart, Clock, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fetchPrayerTimes, fetchPrayerTimesByCoords, PRAYER_ICONS, findNextPrayer, timeUntil, to12HourFormat, PRAYER_KEYS } from '@/services/prayerService';
import type { PrayerInfo, PrayerKey, PrayerStatus, ViewKey } from '@/types';
import { SectionCard, ErrorBanner, LoadingSpinner, Toggle } from '@/components/ui';
import { requestNotificationPermission, describePermission, playAdhanSound } from '@/services/notificationService';

interface Props {
  onChange?: (v: ViewKey) => void;
}

const STATUS_META: Record<PrayerStatus, { label: string; color: string }> = {
  on_time: { label: 'صليت في وقتها', color: 'bg-emerald text-white' },
  late: { label: 'صليت متأخراً', color: 'bg-gold text-white' },
  missed: { label: 'فاتتني', color: 'bg-red-500 text-white' },
};

export default function PrayersView({ onChange }: Props) {
  const { settings, tracking, setPrayerStatus, setPrayers, prayers, location, updateSettings } = useApp();
  const [prayerList, setPrayerList] = useState<PrayerInfo[]>([]);
  const [hijriDate, setHijriDate] = useState('');
  const [readableDate, setReadableDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [nowTick, setNowTick] = useState(0);
  const notifPermRef = useRef(notifPerm);
  notifPermRef.current = notifPerm;

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (location && (location.source === 'gps' || location.source === 'ip')) {
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

  void nowTick;

  const next = prayerList.length ? findNextPrayer(prayerList) : null;
  const nextInfo = next ? timeUntil(next.prayer.time) : null;

  const handleEnableNotifs = async () => {
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === 'granted') {
      updateSettings({ notifications: { ...settings.notifications, enabled: true, prayerReminders: true } });
    }
  };

  const testSound = () => {
    playAdhanSound();
  };

  return (
    <div className="space-y-4 p-4 pb-24 animate-fade-in">
      <div className="flex items-center gap-3">
        {onChange && (
          <button onClick={() => onChange('home')} className="btn-ghost !p-2">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-extrabold text-emerald dark:text-gold-light">الصلوات والمنبه</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            مواقيت الصلاة اليومية وتفعيل تنبيهات الأذان
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-emerald to-emerald-deep p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-100">{readableDate}</p>
            <p className="mt-1 text-lg font-bold text-gold-light">{hijriDate || '—'}</p>
          </div>
          <div className="text-left">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <MapPin size={14} /> {settings.city}
            </p>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <LoadingSpinner label="جارٍ جلب مواقيت الصلاة..." />
      ) : (
        <>
          {next && nextInfo && (
            <div className="card overflow-hidden bg-gradient-to-l from-gold/15 to-transparent">
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-gold-dark dark:text-gold-light mb-2">
                  <Clock size={16} /> الصلاة القادمة
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-extrabold text-emerald dark:text-gold-light flex items-center gap-2">
                      {PRAYER_ICONS[next.prayer.key]} {next.prayer.label}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {(() => {
                        const t = to12HourFormat(next.prayer.time);
                        return (
                          <span className="font-bold">
                            {t.time} <span className="text-gold">{t.periodAr}</span>
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400">متبقٍ حتى الدخول</p>
                    <p className="text-2xl font-extrabold text-emerald dark:text-gold-light">{nextInfo.label}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {prayerList.map((p) => {
              const t12 = to12HourFormat(p.time);
              const isNext = next?.prayer.key === p.key;
              const status = tracking[p.key];
              return (
                <div
                  key={p.key}
                  className={`card p-4 relative overflow-hidden transition active:scale-[0.98] ${
                    isNext ? 'ring-2 ring-gold shadow-lg bg-gradient-to-br from-gold/10 to-transparent' : ''
                  }`}
                >
                  {isNext && (
                    <div className="absolute top-2 left-2 pill bg-gold/20 text-gold-dark dark:text-gold-light text-[10px] font-bold px-2 py-0.5">
                      القادمة
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-4xl mb-1">{PRAYER_ICONS[p.key]}</div>
                    <p className="font-extrabold text-lg text-slate-800 dark:text-slate-100">{p.label}</p>
                    <div className="mt-2">
                      <p className="text-2xl font-extrabold text-emerald dark:text-gold-light">
                        {t12.time}
                      </p>
                      <p className="text-sm font-bold text-gold">
                        {t12.periodAr} ({t12.period})
                      </p>
                    </div>
                    <div className="mt-3">
                      {STATUS_META[status] && (
                        <div className={`pill ${STATUS_META[status].color} text-xs`}>
                          {STATUS_META[status].label}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <SectionCard
            title="متتبع الصلوات"
            icon={<Heart size={18} />}
            action={
              <button onClick={load} className="btn-ghost text-xs !py-1.5 !px-3">
                <RefreshCw size={12} /> تحديث
              </button>
            }
          >
            <div className="space-y-2.5">
              {prayerList.map((p) => (
                <PrayerTrackerRow
                  key={p.key}
                  prayerKey={p.key}
                  label={p.label}
                  time12={to12HourFormat(p.time)}
                  status={tracking[p.key]}
                  onSet={(s) => setPrayerStatus(p.key, s)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="إعدادات المنبه والأذان" icon={<Bell size={18} />}>
            <div className="space-y-4">
              <div className="card p-4 bg-slate-50 dark:bg-emerald-deep/50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">السماح بالإشعارات</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      الحالة: <span className="font-semibold">{describePermission(notifPerm)}</span>
                    </p>
                  </div>
                  {notifPerm !== 'granted' && (
                    <button onClick={handleEnableNotifs} className="btn-gold text-sm !py-2">
                      <Bell size={16} /> تفعيل
                    </button>
                  )}
                </div>
              </div>

              <Toggle
                checked={settings.notifications.enabled && settings.notifications.prayerReminders}
                onChange={(v) =>
                  updateSettings({
                    notifications: {
                      ...settings.notifications,
                      enabled: v || settings.notifications.enabled,
                      prayerReminders: v,
                    },
                  })
                }
                label="تنبيه دخول وقت الصلاة"
                description="سيتم تشغيل صوت الأذان وإظهار إشعار فوري عند حلول وقت كل صلاة."
              />

              <Toggle
                checked={settings.notifications.afterPrayerAdhkar}
                onChange={(v) =>
                  updateSettings({
                    notifications: { ...settings.notifications, afterPrayerAdhkar: v },
                  })
                }
                label="أذكار بعد الصلاة"
                description="تذكير بأذكار ما بعد الصلاة المأثورة بعد دخول الوقت."
              />

              <div className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100">اختبار صوت الأذان</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    اضغط لتجربة نغمة التنبيه قبل دخول الوقت.
                  </p>
                </div>
                <button onClick={testSound} className="btn-ghost">
                  <Volume2 size={18} /> تجربة الصوت
                </button>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

interface TrackerRowProps {
  prayerKey: PrayerKey;
  label: string;
  time12: { time: string; period: string; periodAr: string };
  status: PrayerStatus;
  onSet: (s: PrayerStatus) => void;
}

function PrayerTrackerRow({ label, time12, status, onSet }: TrackerRowProps) {
  const statuses: PrayerStatus[] = ['on_time', 'late', 'missed'];
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 dark:bg-emerald-deep/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-2xl">
          {PRAYER_ICONS[label as keyof typeof PRAYER_ICONS] || '🕌'}
        </span>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {time12.time} <span className="text-gold font-semibold">{time12.periodAr}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onSet(s)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition active:scale-95 ${
              status === s
                ? STATUS_META[s].color
                : 'bg-white dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-emerald-soft/40'
            }`}
          >
            {STATUS_META[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
