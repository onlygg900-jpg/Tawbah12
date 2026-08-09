import { useState } from 'react';
import { RotateCcw, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SectionCard } from '@/components/ui';

const DHIKR_OPTIONS = [
  { label: 'سُبْحَانَ اللَّهِ', value: 'سبحان الله' },
  { label: 'الْحَمْدُ لِلَّهِ', value: 'الحمد لله' },
  { label: 'اللَّهُ أَكْبَرُ', value: 'الله أكبر' },
  { label: 'لَا إِلَهَ إِلَّا اللَّهُ', value: 'لا إله إلا الله' },
  { label: 'أَسْتَغْفِرُ اللَّهَ', value: 'أستغفر الله' },
  { label: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', value: 'سبحان الله وبحمده' },
];

const TARGETS = [33, 99, 100, 1000];

export default function TasbeehCounter() {
  const { tasbeeh, incrementTasbeeh, resetTasbeeh } = useApp();
  const [selected, setSelected] = useState(DHIKR_OPTIONS[0].value);
  const [target, setTarget] = useState(33);
  const count = tasbeeh.count;
  const progress = Math.min(100, (count / target) * 100);
  const completed = count >= target;

  const handleTap = () => {
    incrementTasbeeh(1);
    if (count + 1 === target) {
      // haptic-like feedback
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  return (
    <SectionCard title="المسبحة" icon={<span className="text-emerald dark:text-gold-light">📿</span>}>
      <div className="space-y-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="input text-center font-bold"
        >
          {DHIKR_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <div className="relative flex flex-col items-center">
          <button
            onClick={handleTap}
            className={`relative flex h-32 w-32 items-center justify-center rounded-full text-3xl font-extrabold transition active:scale-95 ${
              completed
                ? 'bg-gold text-white'
                : 'bg-emerald text-white hover:bg-emerald-soft'
            }`}
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" className="stroke-white/20" strokeWidth="4" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                className="stroke-gold-light"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.2s ease' }}
              />
            </svg>
            <span className="relative">{count}</span>
          </button>
          {completed && (
            <p className="mt-2 text-sm font-semibold text-gold-dark dark:text-gold-light animate-scale-in">
              أكملت الورد! 🌟
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {TARGETS.map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                  target === t
                    ? 'bg-emerald text-white dark:bg-gold'
                    : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => incrementTasbeeh(10)} className="btn-ghost px-2 py-1.5 text-xs">
              <Plus size={12} /> +10
            </button>
            <button onClick={resetTasbeeh} className="btn-ghost px-2 py-1.5 text-xs">
              <RotateCcw size={12} /> تصفير
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
