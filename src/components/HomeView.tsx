import { useEffect, useState, useCallback } from 'react';
import { MapPin, RefreshCw, Bell, Sparkles, Navigation, Book, Circle, Clock, ChevronLeft, Heart, ArrowUpRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fetchPrayerTimes, fetchPrayerTimesByCoords, PRAYER_ICONS, findNextPrayer, timeUntil, to12HourFormat } from '@/services/prayerService';
import type { PrayerInfo, ViewKey } from '@/types';
import { SectionCard, ErrorBanner, LoadingSpinner } from '@/components/ui';
import { requestNotificationPermission, describePermission, notifyDhikr } from '@/services/notificationService';
import { getDailyHadith } from '@/services/dhikrService';

interface Props {
  onChange?: (v: ViewKey) => void;
}

const QUICK_LINKS: { key: ViewKey; title: string; subtitle: string; icon: typeof Navigation; gradient: string; emoji: string }[] = [
  {
    key: 'qibla',
    title: 'اتجاه القبلة',
    subtitle: 'بوصلة دقيقة واتجاه الكعبة',
    icon: Navigation,
    gradient: 'from-sky-500 via-blue-500 to-indigo-600',
    emoji: '🧭',
  },
  {
    key: 'prayers',
    title: 'الصلوات والمنبه',
    subtitle: 'مواقيت الصلاة وتفعيل الأذان',
    icon: Bell,
    gradient: 'from-emerald via-teal-600 to-cyan-600',
    emoji: '🕌',
  },
  {
    key: 'tasbeeh',
    title: 'السبحة الإلكترونية',
    subtitle: 'اذكر الله كثيراً بالتسبيح',
    icon: Circle,
    gradient: 'from-amber-400 via-gold to-orange-500',
    emoji: '📿',
  },
  {
    key: 'adhkar',
    title: 'الحديث والأذكار',
    subtitle: 'أحاديث وأذكار يومية متنوّعة',
    icon: Book,
    gradient: 'from-purple-600 via-fuchsia-600 to-pink-600',
    emoji: '📖',
  },
];

export default function HomeView({ onChange }: Props) {
  const { settings, tracking, setPrayerStatus, setPrayers, prayers, location, updateSettings } = useApp();
  const [prayerList, setPrayerList] = useState<PrayerInfo[]>([]);
  const [hijriDate, setHijriDate] = useState('');
  const [readableDate, setReadableDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [dailyHadith] = useState(getDailyHadith());
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 15_000);
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
  void tracking;
  void setPrayerStatus;
  void prayers;

  const next = prayerList.length ? findNextPrayer(prayerList) : null;
  const nextInfo = next ? timeUntil(next.prayer.time) : null;

  const handleEnableNotifs = async () => {
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === 'granted') {
      updateSettings({
        notifications: {
          ...settings.notifications,
          enabled: true,
          morningAdhkar: true,
          eveningAdhkar: true,
          afterPrayerAdhkar: true,
          dailyHadith: true,
          prayerReminders: true,
        },
      });
      notifyDhikr('daily');
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24 animate-fade-in">
      {/* 1) WELCOME HEADER — الإبقاء عليه كما طلب المستخدم */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald via-emerald to-emerald-deep p-5 text-white shadow-lg shadow-emerald/20 overflow-hidden relative">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">🌙</span>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-wide">توبة</h1>
                  <p className="text-emerald-50/90 text-sm font-semibold -mt-0.5">رفيقك الروحي اليومي</p>
                </div>
              </div>
            </div>
            <div className="text-left max-w-[55%]">
              <p className="flex items-center justify-end gap-1 text-sm font-bold bg-white/10 px-3 py-1 rounded-full w-fit mr-auto">
                <MapPin size={13} /> {settings.city}
              </p>
              <p className="text-xs text-emerald-100/90 mt-2 font-semibold leading-relaxed">
                {readableDate}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 border border-white/15">
            <div className="h-9 w-9 rounded-xl bg-gold/30 flex items-center justify-center shrink-0">
              📅
            </div>
            <div>
              <p className="text-[11px] text-emerald-100/80 font-semibold">التاريخ الهجري</p>
              <p className="text-base font-extrabold text-gold-light leading-tight">{hijriDate || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* 2) PRAYER TIMES CARDS — بنظام 12 ساعة AM/PM */}
      {loading ? (
        <LoadingSpinner label="جارٍ جلب مواقيت الصلاة..." />
      ) : prayerList.length > 0 ? (
        <div className="space-y-3">
          {/* NEXT PRAYER HERO CARD */}
          {next && nextInfo && (
            <button
              onClick={() => onChange?.('prayers')}
              className="w-full text-right card overflow-hidden bg-gradient-to-l from-gold/15 via-white to-emerald/5 dark:from-gold/10 dark:via-emerald-deep/60 dark:to-emerald/10 p-5 hover:shadow-lg transition active:scale-[0.99] group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-gold-dark dark:text-gold-light">
                  <Clock size={15} /> الصلاة القادمة
                </div>
                <ChevronLeft size={18} className="text-slate-400 group-hover:-translate-x-1 group-hover:text-emerald dark:group-hover:text-gold-light transition" />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`h-20 w-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg bg-gradient-to-br from-emerald/15 to-gold/20 dark:from-gold/20 dark:to-emerald/10 ring-2 ring-white dark:ring-emerald-deep`}>
                    {PRAYER_ICONS[next.prayer.key]}
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-emerald dark:text-gold-light leading-tight">
                      {next.prayer.label}
                    </p>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
                      {(() => {
                        const t = to12HourFormat(next.prayer.time);
                        return (
                          <>
                            <span className="text-2xl text-emerald dark:text-gold-light">{t.time}</span>
                            <span className="mr-1 text-gold">{t.periodAr}</span>
                            <span className="text-xs opacity-60 mr-1">({t.period})</span>
                          </>
                        );
                      })()}
                    </p>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1">متبقٍ حتى الدخول</p>
                  <p className="text-2xl font-extrabold text-emerald dark:text-gold-light leading-none">{nextInfo.label}</p>
                </div>
              </div>
            </button>
          )}

          {/* PRAYER CARDS GRID — بطاقات كل صلاة بصيغة 12 ساعة */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {prayerList.map((p) => {
              const t12 = to12HourFormat(p.time);
              const isNext = next?.prayer.key === p.key;
              const done = tracking[p.key] !== 'missed';
              return (
                <div
                  key={p.key}
                  className={`card p-4 relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md ${
                    isNext
                      ? 'ring-2 ring-gold shadow-lg bg-gradient-to-br from-gold/10 via-white to-white dark:from-gold/10 dark:via-emerald-deep/60 dark:to-emerald-deep/60'
                      : ''
                  }`}
                >
                  {done && (
                    <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-emerald flex items-center justify-center text-white text-[10px] font-extrabold shadow">
                      ✓
                    </div>
                  )}
                  {isNext && !done && (
                    <div className="absolute top-2 left-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-gold" />
                      </span>
                    </div>
                  )}
                  <div className="text-center pt-1">
                    <div className="text-4xl mb-2 filter drop-shadow-sm">{PRAYER_ICONS[p.key]}</div>
                    <p className="font-extrabold text-base text-slate-800 dark:text-slate-100">{p.label}</p>
                    <div className="mt-2.5 rounded-2xl bg-slate-50 dark:bg-emerald-deep/40 py-2 px-3 border border-slate-100 dark:border-emerald-soft/30">
                      <p className="text-2xl font-extrabold text-emerald dark:text-gold-light leading-tight">
                        {t12.time}
                      </p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <span className="pill bg-gold/15 text-gold-dark dark:text-gold-light text-[10px] font-extrabold px-2 py-0.5">
                          {t12.periodAr}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          {t12.period}
                        </span>
                      </div>
                    </div>
                    {STATUS_META[tracking[p.key]] && (
                      <div className={`mt-2 text-[10px] font-extrabold ${
                        tracking[p.key] === 'on_time' ? 'text-emerald' :
                        tracking[p.key] === 'late' ? 'text-gold-dark dark:text-gold-light' :
                        'text-red-500'
                      }`}>
                        {STATUS_META[tracking[p.key]].label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={load}
            className="w-full card py-2.5 text-xs font-bold text-slate-500 hover:text-emerald dark:hover:text-gold-light flex items-center justify-center gap-1.5 transition hover:bg-slate-50 dark:hover:bg-emerald-soft/30"
          >
            <RefreshCw size={13} /> تحديث مواقيت الصلاة
          </button>
        </div>
      ) : null}

      {/* 3) QUICK GRID CARDS — شبكة الأقسام الرئيسية التفاعلية */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Heart size={18} className="text-emerald dark:text-gold-light" />
            الأقسام الرئيسية
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            انقر للانتقال المباشر
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.key}
                onClick={() => onChange?.(link.key)}
                className="group relative overflow-hidden rounded-3xl p-4 text-right text-white shadow-md hover:shadow-xl transition-all active:scale-[0.97] hover:-translate-y-1"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient}`} />
                <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
                <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
                <div className="relative z-10 flex flex-col h-full min-h-[140px] justify-between">
                  <div className="flex items-start justify-between">
                    <div className={`h-12 w-12 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center shadow-inner ring-1 ring-white/30`}>
                      <span className="text-2xl">{link.emoji}</span>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white group-hover:scale-110 transition">
                      <ArrowUpRight size={16} className="text-white group-hover:text-emerald" />
                    </div>
                  </div>
                  <div className="mt-6">
                    <h3 className="text-lg font-extrabold leading-tight drop-shadow-sm">{link.title}</h3>
                    <p className="text-[11px] text-white/90 mt-1 font-semibold leading-snug drop-shadow">
                      {link.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4) DAILY HADITH CARD */}
      <SectionCard title="حديث اليوم" icon={<Sparkles size={18} />} className="border-gold/30 bg-gradient-to-br from-gold/5 via-white to-gold/5 dark:from-gold/10 dark:via-emerald-deep/60 dark:to-gold/5">
        <p className="quran-text text-lg leading-loose text-slate-800 dark:text-slate-100">
          {dailyHadith.text}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs font-extrabold text-gold-dark dark:text-gold-light flex items-center gap-1.5">
            <Sparkles size={12} /> — {dailyHadith.source}
          </p>
          <button
            onClick={() => onChange?.('adhkar')}
            className="text-[11px] font-bold text-emerald dark:text-gold-light flex items-center gap-1 hover:underline"
          >
            المزيد من الأحاديث والأذكار <ChevronLeft size={13} />
          </button>
        </div>
      </SectionCard>

      {/* 5) NOTIFICATION PROMPT */}
      {notifPerm !== 'granted' && (
        <SectionCard
          title="تفعيل التنبيهات والأذكار"
          icon={<Bell size={18} />}
          className="border-emerald/30 bg-emerald/5 dark:bg-emerald-soft/15"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-emerald to-emerald-soft flex items-center justify-center text-white shadow-md text-2xl">
              🔔
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                فعّل الإشعارات لتذكيرك بمواقيت الصلاة و<span className="font-bold text-emerald dark:text-gold-light">الأذكار المتكرّرة كل ١٠-١٥ دقيقة</span>.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                الحالة الحالية: <span className="font-extrabold">{describePermission(notifPerm)}</span>
              </p>
            </div>
            <button onClick={handleEnableNotifs} className="btn-gold sm:shrink-0 w-full sm:w-auto justify-center">
              <Bell size={16} /> السماح بالإشعارات
            </button>
          </div>
        </SectionCard>
      )}

      {/* Footer greeting */}
      <div className="text-center pt-2 pb-2">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
          ﴿ وَذَكِّرْ فَإِنَّ الذِّكْرَىٰ تَنفَعُ الْمُؤْمِنِينَ ﴾
        </p>
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string }> = {
  on_time: { label: 'صليت في وقتها ✓' },
  late: { label: 'صليت متأخراً' },
  missed: { label: '' },
};
