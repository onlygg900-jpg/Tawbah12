import { Home, BookOpen, Users, Settings as SettingsIcon, Sparkles, Moon, Navigation, Bell, Book, Circle } from 'lucide-react';
import type { ViewKey } from '@/types';
import { useApp } from '@/context/AppContext';

interface SideNavProps {
  current: ViewKey;
  onChange: (v: ViewKey) => void;
}

const TABS: { key: ViewKey; label: string; icon: typeof Home; group?: string }[] = [
  { key: 'home', label: 'الرئيسية', icon: Home },
  { key: 'prayers', label: 'الصلوات والمنبه', icon: Bell, group: 'الأقسام الرئيسية' },
  { key: 'qibla', label: 'اتجاه القبلة', icon: Navigation },
  { key: 'tasbeeh', label: 'المسبحة', icon: Circle },
  { key: 'adhkar', label: 'الحديث والأذكار', icon: Book },
  { key: 'quran', label: 'القرآن الكريم', icon: BookOpen, group: 'أقسام أخرى' },
  { key: 'assistant', label: 'مساعد توبة', icon: Sparkles },
  { key: 'challenges', label: 'التحديات', icon: Users },
  { key: 'settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function SideNav({ current, onChange }: SideNavProps) {
  const { settings } = useApp();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-slate-200/80 bg-white/80 dark:border-emerald-soft/30 dark:bg-emerald-deep/80 backdrop-blur-lg lg:flex">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald to-emerald-deep text-white shadow-md">
          <Moon size={22} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-emerald dark:text-gold-light">توبة</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">رفيقك الروحي اليومي</p>
        </div>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3 overflow-y-auto no-scrollbar pb-4">
        {TABS.map((tab, idx) => {
          const Icon = tab.icon;
          const active = current === tab.key;
          const prev = TABS[idx - 1];
          const showHeader = tab.group && prev?.group !== tab.group;
          return (
            <div key={tab.key} className={showHeader ? 'mt-3 first:mt-0' : ''}>
              {showHeader && (
                <p className="mb-1.5 px-4 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-emerald-soft/20">
                  {tab.group}
                </p>
              )}
              <button
                onClick={() => onChange(tab.key)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? 'bg-emerald/10 dark:bg-gold/15 text-emerald dark:text-gold-light'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-emerald-soft/20'
                }`}
              >
                <Icon size={19} className={active ? 'text-emerald dark:text-gold-light' : ''} />
                <span className="flex-1 text-right">{tab.label}</span>
                {active && <span className="h-2 w-2 rounded-full bg-emerald dark:bg-gold-light" />}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="px-6 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
        توبة v1.0 · صُنع بحب لمرضاة الله
      </div>
    </aside>
  );
}
