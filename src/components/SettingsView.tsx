import { useState } from 'react';
import {
  Moon,
  Sun,
  User,
  Mail,
  Bell,
  Shield,
  Lock,
  Unlock,
  MapPin,
  LogIn,
  Globe,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Info,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SectionCard, Toggle, Modal } from '@/components/ui';
import { requestNotificationPermission, describePermission, notificationSupported } from '@/services/notificationService';
import type { ContentBlockerSettings } from '@/types';

type SubSection = 'profile' | 'notifications' | 'location' | 'contentBlocker';

export default function SettingsView() {
  const [section, setSection] = useState<SubSection | null>(null);

  const rows: { key: SubSection; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'الملف الشخصي', desc: 'الاسم، البريد، تسجيل الدخول', icon: <User size={20} /> },
    { key: 'location', label: 'الموقع والمواقيت', desc: 'المدينة، الدولة، طريقة الحساب', icon: <MapPin size={20} /> },
    { key: 'notifications', label: 'الإشعارات والأذكار', desc: 'تنبيهات الصلاة والأذكار', icon: <Bell size={20} /> },
    { key: 'contentBlocker', label: 'حجب المحتوى وحماية العائلة', desc: 'حجب المحتوى الإباحي عبر DNS', icon: <Shield size={20} /> },
  ];

  if (section) {
    return (
      <div className="p-4 pb-24 animate-fade-in">
        <button onClick={() => setSection(null)} className="btn-ghost mb-3 px-3 py-2 text-sm">
          <ChevronRight size={16} /> رجوع للإعدادات
        </button>
        {section === 'profile' && <ProfileSection />}
        {section === 'location' && <LocationSection />}
        {section === 'notifications' && <NotificationsSection />}
        {section === 'contentBlocker' && <ContentBlockerSection />}
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 animate-fade-in space-y-4">
      <ThemeToggle />
      <SectionCard title="الإعدادات" icon={<User size={18} />}>
        <div className="divide-y divide-slate-100 dark:divide-emerald-soft/30">
          {rows.map((r) => (
            <button
              key={r.key}
              onClick={() => setSection(r.key)}
              className="flex w-full items-center justify-between py-3 text-right transition hover:bg-slate-50 dark:hover:bg-emerald-deep/30"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald/10 dark:bg-gold/15 text-emerald dark:text-gold-light">
                  {r.icon}
                </span>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{r.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.desc}</p>
                </div>
              </div>
              <ChevronLeft className="text-slate-400" size={18} />
            </button>
          ))}
        </div>
      </SectionCard>
      <p className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
        توبة v1.0 · صُنع بحب لمرضاة الله
      </p>
    </div>
  );
}

function ThemeToggle() {
  const { settings, toggleTheme } = useApp();
  return (
    <SectionCard title="المظهر" icon={settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}>
      <div className="flex gap-2">
        <button
          onClick={() => settings.theme !== 'light' && toggleTheme()}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition ${
            settings.theme === 'light' ? 'bg-emerald text-white' : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Sun size={16} /> فاتح
        </button>
        <button
          onClick={() => settings.theme !== 'dark' && toggleTheme()}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition ${
            settings.theme === 'dark' ? 'bg-emerald text-white' : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Moon size={16} /> داكن
        </button>
      </div>
    </SectionCard>
  );
}

function ProfileSection() {
  const { profile, updateProfile, signInGoogle, signOut } = useApp();
  const [name, setName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [signingIn, setSigningIn] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const colors = ['#d97706', '#064e3b', '#0f766e', '#b45309', '#0369a1', '#7c2d12'];

  const handleGoogle = async () => {
    setSigningIn(true);
    await signInGoogle();
    setSigningIn(false);
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await signOut();
    setSignOutLoading(false);
  };

  return (
    <div className="space-y-4">
      <SectionCard title="الملف الشخصي" icon={<User size={18} />}>
        <div className="mb-4 flex flex-col items-center gap-2">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="h-20 w-20 rounded-full object-cover shadow-md border-2 border-gold/40"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white shadow-md"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {profile.displayName.charAt(0)}
            </div>
          )}
          {!profile.avatarUrl && (
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => updateProfile({ avatarColor: c })}
                  className={`h-6 w-6 rounded-full border-2 transition ${
                    profile.avatarColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">الاسم الظاهر</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: محمد حسين" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="example@mail.com" className="input pr-9" />
            </div>
          </div>
          <button
            onClick={() => updateProfile({ displayName: name || 'ضيف توبة', email })}
            className="btn-primary w-full"
          >
            <Check size={16} /> حفظ التغييرات
          </button>
        </div>
      </SectionCard>

      <SectionCard title="تسجيل الدخول" icon={<LogIn size={18} />}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          مزامنة بياناتك عبر الأجهزة باستخدام Supabase. سجّل الدخول بحساب Google لحفظ تقدمك في السحابة.
        </p>
        {!profile.loggedIn ? (
          <div className="space-y-2">
            <button
              onClick={handleGoogle}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-emerald-deep border-2 border-slate-200 dark:border-emerald-soft/30 px-4 py-3 font-bold text-slate-700 dark:text-slate-100 hover:border-gold/50 transition disabled:opacity-60 active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              {signingIn ? 'جارٍ التحويل...' : 'تسجيل الدخول بحساب Google'}
            </button>
            <p className="flex items-start gap-1 text-xs text-slate-400 dark:text-slate-500">
              <Info size={12} className="mt-0.5 shrink-0" />
              عند تسجيل الدخول، تُزامن بياناتك تلقائياً مع قاعدة البيانات السحابية.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl bg-emerald/10 dark:bg-gold/10 p-3 flex items-center gap-2 text-sm">
              <Check size={16} className="text-emerald dark:text-gold-light shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100">مسجّل الدخول بنجاح</p>
                {profile.email && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile.email}</p>}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="w-full rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition disabled:opacity-60 active:scale-[0.98]"
            >
              {signOutLoading ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function LocationSection() {
  const { settings, updateSettings } = useApp();
  const [city, setCity] = useState(settings.city);
  const [country, setCountry] = useState(settings.country);

  const methods = [
    { id: 4, name: 'أم القرى (مكة)' },
    { id: 5, name: 'الهيئة المصرية للمساحة' },
    { id: 3, name: 'رابطة العالم الإسلامي' },
    { id: 2, name: 'جمعية الإسلامية بأمريكا الشمالية (ISNA)' },
    { id: 1, name: 'جامعة العلوم الإسلامية (كراتشي)' },
    { id: 8, name: 'منطقة الخليج' },
  ];

  return (
    <SectionCard title="الموقع والمواقيت" icon={<MapPin size={18} />}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-semibold">المدينة</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="مكة" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">الدولة</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="السعودية" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">طريقة حساب المواقيت</label>
          <select
            value={settings.calcMethod}
            onChange={(e) => updateSettings({ calcMethod: Number(e.target.value) })}
            className="input"
          >
            {methods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => updateSettings({ city, country })}
          className="btn-primary w-full"
        >
          <Check size={16} /> حفظ
        </button>
        <p className="flex items-start gap-1 text-xs text-slate-400 dark:text-slate-500">
          <Info size={12} className="mt-0.5 shrink-0" />
          ستُحدّث مواقيت الصلاة تلقائياً على الصفحة الرئيسية بعد الحفظ.
        </p>
      </div>
    </SectionCard>
  );
}

function NotificationsSection() {
  const { settings, updateSettings } = useApp();
  const n = settings.notifications;
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const supported = notificationSupported();

  const setN = (patch: Partial<typeof n>) =>
    updateSettings({ notifications: { ...n, ...patch } });

  const enable = async () => {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === 'granted') setN({ enabled: true });
  };

  return (
    <div className="space-y-4">
      <SectionCard title="إذن الإشعارات" icon={<Bell size={18} />}>
        {!supported ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">متصفحك لا يدعم الإشعارات. جرّب فتح التطبيق عبر Chrome على الأندرويد أو Safari على iOS.</p>
        ) : perm === 'granted' ? (
          <p className="text-sm font-semibold text-emerald dark:text-gold-light flex items-center gap-1">
            <Check size={16} /> الإشعارات مفعّلة ({describePermission(perm)})
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">الحالة: {describePermission(perm)}</p>
            <button onClick={enable} className="btn-gold w-full">
              <Bell size={16} /> السماح بالإشعارات
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="تنبيهات الأذكار" icon={<Bell size={18} />}>
        <div className="divide-y divide-slate-100 dark:divide-emerald-soft/30">
          <Toggle
            label="تفعيل كل التنبيهات"
            description="الزر الرئيسي لجميع الإشعارات"
            checked={n.enabled}
            onChange={(v) => setN({ enabled: v })}
          />
          <Toggle
            label="تنبيهات مواقيت الصلاة"
            description="تذكير عند دخول كل صلاة مع حديث/ذكر"
            checked={n.prayerReminders}
            onChange={(v) => setN({ prayerReminders: v })}
          />
          <Toggle
            label="أذكار الصباح والمساء"
            description="تذكير يومي بسلسلة أذكار الصباح والمساء"
            checked={n.morningAdhkar && n.eveningAdhkar}
            onChange={(v) => setN({ morningAdhkar: v, eveningAdhkar: v })}
          />
          <Toggle
            label="أذكار بعد الصلاة"
            description="تذكير بأذكار ما بعد الصلاة"
            checked={n.afterPrayerAdhkar}
            onChange={(v) => setN({ afterPrayerAdhkar: v })}
          />
          <Toggle
            label="أحاديث يومية"
            description="حديث نبوي شريف كل يوم"
            checked={n.dailyHadith}
            onChange={(v) => setN({ dailyHadith: v })}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function ContentBlockerSection() {
  const { settings, updateSettings } = useApp();
  const cb = settings.contentBlocker;
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [showGuide, setShowGuide] = useState<'adguard' | 'cloudflare' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const setCb = (patch: Partial<ContentBlockerSettings>) =>
    updateSettings({ contentBlocker: { ...cb, ...patch } });

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const setProvider = (provider: 'adguard' | 'cloudflare') => {
    setCb({ enabled: true, provider });
  };

  return (
    <div className="space-y-4">
      <SectionCard title="حجب المحتوى الإباحي" icon={<Shield size={18} />}>
        <div className="mb-3 rounded-xl bg-emerald/10 dark:bg-gold/10 p-3 text-sm text-slate-700 dark:text-slate-200">
          يحمي هذا الخيار عائلتك من المحتوى الإباحي والمخالف عبر تعيين خادم DNS آمن على أجهزتك أو راوتر المنزل. لا حاجة لتطبيق إضافي — فقط اتبع الخطوات.
        </div>
        <Toggle
          label="تفعيل حجب المحتوى"
          description="اختر مزود DNS الآمن بالأسفل"
          checked={cb.enabled}
          onChange={(v) => setCb({ enabled: v, provider: v && cb.provider === 'none' ? 'adguard' : cb.provider })}
        />
      </SectionCard>

      <SectionCard title="اختر مزود DNS" icon={<Globe size={18} />}>
        <div className="space-y-2">
          <ProviderCard
            title="AdGuard Family DNS"
            desc="يحجب المواقع الإباحية والملفات الخبيثة"
            active={cb.provider === 'adguard'}
            onSelect={() => setProvider('adguard')}
            primary="94.140.14.15"
            secondary="94.140.15.16"
            onGuide={() => setShowGuide('adguard')}
            copied={copied}
            onCopy={copy}
          />
          <ProviderCard
            title="Cloudflare 1.1.1.3 for Families"
            desc="يحجب البرمجيات الخبيثة والمحتوى للبالغين"
            active={cb.provider === 'cloudflare'}
            onSelect={() => setProvider('cloudflare')}
            primary="1.1.1.3"
            secondary="1.0.0.3"
            onGuide={() => setShowGuide('cloudflare')}
            copied={copied}
            onCopy={copy}
          />
        </div>
      </SectionCard>

      {/* Admin Lock */}
      <SectionCard title="قفل الإعدادات (ولي الأمر)" icon={cb.adminLocked ? <Lock size={18} /> : <Unlock size={18} />}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          فعّل قفل رمزي لمنع الأبناء من إيقاف حجب المحتوى. سيُطلب الرمز عند تعطيل الحجب.
        </p>
        {cb.adminLocked ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-sm font-semibold text-emerald dark:text-gold-light">
              <Lock size={14} /> القفل مفعّل
            </p>
            <button
              onClick={() => setShowPin(true)}
              className="btn-ghost w-full text-sm"
            >
              <Unlock size={14} /> إيقاف القفل (يتطلب الرمز)
            </button>
          </div>
        ) : (
          <button onClick={() => { setShowPin(true); setPin(''); }} className="btn-primary w-full">
            <Lock size={16} /> تفعيل القفل الرمزي
          </button>
        )}
      </SectionCard>

      {/* PIN Modal */}
      <Modal open={showPin} onClose={() => setShowPin(false)} title={cb.adminLocked ? 'إيقاف قفل الإعدادات' : 'تعيين رمز القفل'}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {cb.adminLocked ? 'أدخل الرمز الحالي لإيقاف القفل:' : 'أدخل رمزاً مكوناً من ٤ أرقام:'}
          </p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            inputMode="numeric"
            className="input text-center text-2xl tracking-[0.5em] font-bold"
          />
          <button
            onClick={() => {
              if (cb.adminLocked) {
                if (pin === cb.adminPin) {
                  setCb({ adminLocked: false, adminPin: null });
                  setShowPin(false);
                }
              } else if (pin.length === 4) {
                setCb({ adminLocked: true, adminPin: pin });
                setShowPin(false);
              }
            }}
            className="btn-primary w-full"
          >
            <Lock size={16} /> تأكيد
          </button>
        </div>
      </Modal>

      {/* DNS Guides */}
      <Modal open={showGuide === 'adguard'} onClose={() => setShowGuide(null)} title="دليل إعداد AdGuard Family DNS">
        <DnsGuide
          provider="AdGuard Family"
          primary="94.140.14.15"
          secondary="94.140.15.16"
          onCopy={copy}
          copied={copied}
        />
      </Modal>
      <Modal open={showGuide === 'cloudflare'} onClose={() => setShowGuide(null)} title="دليل إعداد Cloudflare 1.1.1.3">
        <DnsGuide
          provider="Cloudflare 1.1.1.3"
          primary="1.1.1.3"
          secondary="1.0.0.3"
          onCopy={copy}
          copied={copied}
        />
      </Modal>
    </div>
  );
}

interface ProviderCardProps {
  title: string;
  desc: string;
  active: boolean;
  onSelect: () => void;
  primary: string;
  secondary: string;
  onGuide: () => void;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}

function ProviderCard({ title, desc, active, onSelect, primary, secondary, onGuide, copied, onCopy }: ProviderCardProps) {
  return (
    <div className={`rounded-xl border p-3 transition ${active ? 'border-emerald bg-emerald/5 dark:border-gold/40 dark:bg-gold/5' : 'border-slate-200 dark:border-emerald-soft/30'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <button onClick={onSelect} className={`mt-0.5 h-5 w-5 rounded-full border-2 ${active ? 'border-emerald dark:border-gold bg-emerald dark:bg-gold' : 'border-slate-300 dark:border-emerald-soft/50'}`}>
            {active && <Check size={12} className="text-white" />}
          </button>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100">{title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
          </div>
        </div>
        <button onClick={onGuide} className="text-xs font-semibold text-emerald dark:text-gold-light underline">
          دليل الإعداد
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        {[primary, secondary].map((ip) => (
          <button
            key={ip}
            onClick={() => onCopy(ip, ip)}
            className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-emerald-deep/50 px-2 py-1 text-xs font-mono font-bold text-slate-700 dark:text-slate-200"
          >
            {ip} {copied === ip ? <Check size={10} className="text-emerald" /> : <Copy size={10} />}
          </button>
        ))}
      </div>
    </div>
  );
}

interface DnsGuideProps {
  provider: string;
  primary: string;
  secondary: string;
  onCopy: (text: string, key: string) => void;
  copied: string | null;
}

function DnsGuide({ provider, primary, secondary, onCopy, copied }: DnsGuideProps) {
  return (
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
      <div className="rounded-xl bg-slate-50 dark:bg-emerald-deep/40 p-3">
        <p className="mb-1 font-bold">عناوين DNS:</p>
        <div className="flex gap-2">
          {[primary, secondary].map((ip) => (
            <button key={ip} onClick={() => onCopy(ip, ip)} className="flex items-center gap-1 rounded-lg bg-white dark:bg-emerald-soft/30 px-2 py-1 font-mono font-bold">
              {ip} {copied === ip ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 font-bold text-emerald dark:text-gold-light">Android:</p>
        <ol className="list-decimal space-y-1 pr-4 text-xs">
          <li>الإعدادات ← الشبكة والإنترنت ← DNS الخاص</li>
          <li>اختر "DNS الخاص" وحدد اسم مضيف مخصص</li>
          <li>أدخل: {provider === 'AdGuard Family' ? 'dns.adguard-dns.com' : 'family.cloudflare-dns.com'}</li>
          <li>احفظ وأعد تشغيل Wi-Fi</li>
        </ol>
      </div>

      <div>
        <p className="mb-1 font-bold text-emerald dark:text-gold-light">iPhone / iPad:</p>
        <ol className="list-decimal space-y-1 pr-4 text-xs">
          <li>الإعدادات ← Wi-Fi ← اضغط (i) بجانب شبكتك</li>
          <li>اكتب DNS وأضف {primary} و {secondary}</li>
          <li>احفظ وأعد الاتصال بالشبكة</li>
        </ol>
      </div>

      <div>
        <p className="mb-1 font-bold text-emerald dark:text-gold-light">الراوتر (لحماية كل المنزل):</p>
        <ol className="list-decimal space-y-1 pr-4 text-xs">
          <li>ادخل صفحة الراوتر (غالباً 192.168.1.1)</li>
          <li>ابحث عن إعدادات DNS / WAN</li>
          <li>ضع {primary} كأساسي و {secondary} كثانوي</li>
          <li>احفظ وأعد تشغيل الراوتر</li>
        </ol>
      </div>

      <p className="flex items-start gap-1 text-xs text-slate-400 dark:text-slate-500">
        <Info size={12} className="mt-0.5 shrink-0" />
        بعد الإعداد، استخدم "قفل الإعدادات" لمنع تغييره بدون رمز ولي الأمر.
      </p>
    </div>
  );
}
