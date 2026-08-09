import { Home, BookOpen, Users, Settings as SettingsIcon } from 'lucide-react';
import type { ViewKey } from '@/types';

interface NavBarProps {
  current: ViewKey;
  onChange: (v: ViewKey) => void;
}

const TABS: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'الرئيسية', icon: Home },
  { key: 'quran', label: 'القرآن', icon: BookOpen },
  { key: 'challenges', label: 'التحديات', icon: Users },
  { key: 'settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function BottomNav({ current, onChange }: NavBarProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/80 dark:border-emerald-soft/30 bg-white/90 dark:bg-emerald-deep/90 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 transition"
            >
              <div className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all ${active ? 'bg-emerald/10 dark:bg-gold/15' : ''}`}>
                <Icon
                  size={20}
                  className={active ? 'text-emerald dark:text-gold-light' : 'text-slate-400 dark:text-slate-500'}
                />
                {active && (
                  <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-emerald dark:bg-gold-light" />
                )}
              </div>
              <span className={`text-[10px] font-bold ${active ? 'text-emerald dark:text-gold-light' : 'text-slate-400 dark:text-slate-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
