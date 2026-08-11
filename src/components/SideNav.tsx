import { Home, BookOpen, Users, Settings as SettingsIcon, Sparkles, Moon } from 'lucide-react';
import type { ViewKey } from '@/types';
import { useApp } from '@/context/AppContext';

interface SideNavProps {
  current: ViewKey;
  onChange: (v: ViewKey) => void;
}

const TABS: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'الرئيسية', icon: Home },
  { key: 'quran', label: 'القرآن', icon: BookOpen },
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

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                active
                  ? 'bg-emerald/10 dark:bg-gold/15 text-emerald dark:text-gold-light'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-emerald-soft/20'
              }`}
            >
              <Icon size={20} className={active ? 'text-emerald dark:text-gold-light' : ''} />
              {tab.label}
              {active && <span className="mr-auto h-2 w-2 rounded-full bg-emerald dark:bg-gold-light" />}
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
        توبة v1.0 · صُنع بحب لمرضاة الله
      </div>
    </aside>
  );
}
