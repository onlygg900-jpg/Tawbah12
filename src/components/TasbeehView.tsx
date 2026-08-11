import { useState } from 'react';
import { ArrowLeft, RotateCcw, Plus, Minus, Trophy } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SectionCard } from '@/components/ui';
import type { ViewKey } from '@/types';

interface Props {
  onChange?: (v: ViewKey) => void;
}

const DHIKR_OPTIONS = [
  { label: 'سُبْحَانَ اللَّهِ', value: 'سبحان الله', defaultTarget: 33, reward: 'حبة حسنة لكل مائة' },
  { label: 'الْحَمْدُ لِلَّهِ', value: 'الحمد لله', defaultTarget: 33, reward: 'تملأ الميزان' },
  { label: 'اللَّهُ أَكْبَرُ', value: 'الله أكبر', defaultTarget: 34, reward: 'أثقل في الميزان' },
  { label: 'لَا إِلَهَ إِلَّا اللَّهُ', value: 'لا إله إلا الله', defaultTarget: 100, reward: 'كفارة الخطايا' },
  { label: 'أَسْتَغْفِرُ اللَّهَ', value: 'أستغفر الله', defaultTarget: 100, reward: 'غفران الذنوب' },
  { label: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', value: 'سبحان الله وبحمده', defaultTarget: 100, reward: 'أحب الأذكار' },
  { label: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ سُبْحَانَ اللهِ الْعَظِيمِ', value: 'سبحان الله وبحمده العظيم', defaultTarget: 100, reward: 'ثقلان في الميزان' },
  { label: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', value: 'لا حول ولا قوة إلا بالله', defaultTarget: 100, reward: 'كنز من الجنة' },
  { label: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', value: 'صلاة على النبي', defaultTarget: 100, reward: 'شفاعة النبي ﷺ' },
];

const TARGETS = [33, 99, 100, 500, 1000];

export default function TasbeehView({ onChange }: Props) {
  const { tasbeeh, incrementTasbeeh, resetTasbeeh, stats } = useApp();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = DHIKR_OPTIONS[selectedIdx];
  const [target, setTarget] = useState(selected.defaultTarget);
  const count = tasbeeh.count;
  const progress = Math.min(100, (count / target) * 100);
  const completed = count >= target;

  const handleTap = () => {
    incrementTasbeeh(1);
    if ((count + 1) === target && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    } else if (navigator.vibrate) {
      navigator.vibrate(10);
    }
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
          <h1 className="text-2xl font-extrabold text-emerald dark:text-gold-light">المسبحة الإلكترونية</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            اذكر الله كثيراً واحصل على الأجر العظيم
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-4 bg-gradient-to-br from-emerald/10 to-transparent dark:from-emerald-soft/20 dark:to-transparent">
          <p className="text-xs text-slate-500 dark:text-slate-400">العد اليومي</p>
          <p className="text-3xl font-extrabold text-emerald dark:text-gold-light mt-1">{count}</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-gold/10 to-transparent dark:from-gold/10 dark:to-transparent">
          <p className="text-xs text-slate-500 dark:text-slate-400">الهدف الحالي</p>
          <p className="text-3xl font-extrabold text-gold-dark dark:text-gold-light mt-1">{target}</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-emerald/10 to-transparent dark:from-emerald-soft/20 dark:to-transparent">
          <p className="text-xs text-slate-500 dark:text-slate-400">التقدم</p>
          <p className="text-3xl font-extrabold text-emerald dark:text-gold-light mt-1">
            {Math.floor(progress)}<span className="text-lg">%</span>
          </p>
        </div>
      </div>

      <SectionCard title="اختر الذكر المفضل" icon={<span className="text-emerald dark:text-gold-light">📿</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
          {DHIKR_OPTIONS.map((d, i) => {
            const active = i === selectedIdx;
            return (
              <button
                key={d.value}
                onClick={() => {
                  setSelectedIdx(i);
                  setTarget(d.defaultTarget);
                }}
                className={`text-right p-3 rounded-xl border transition active:scale-95 ${
                  active
                    ? 'border-emerald bg-emerald/10 dark:border-gold dark:bg-gold/10 shadow-inner'
                    : 'border-slate-200 dark:border-emerald-soft/30 bg-white dark:bg-emerald-deep/40 hover:border-emerald/50 dark:hover:border-gold/50'
                }`}
              >
                <p className={`quran-text font-bold ${active ? 'text-emerald dark:text-gold-light' : 'text-slate-800 dark:text-slate-100'}`}>
                  {d.label}
                </p>
                <p className="text-[11px] mt-1 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Trophy size={11} /> {d.reward}
                </p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className="card p-6 bg-gradient-to-br from-emerald/5 via-white to-gold/5 dark:from-emerald-soft/20 dark:via-emerald-deep/60 dark:to-gold/10">
        <div className="text-center mb-6">
          <p className="quran-text text-2xl sm:text-3xl font-extrabold text-emerald dark:text-gold-light mb-2 leading-relaxed">
            {selected.label}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 pill bg-white/60 dark:bg-emerald-deep/40 inline-flex px-3 py-1">
            فضل: {selected.reward}
          </p>
        </div>

        <div className="relative flex flex-col items-center">
          <button
            onClick={handleTap}
            className={`relative flex h-48 w-48 sm:h-56 sm:w-56 items-center justify-center rounded-full text-5xl sm:text-6xl font-extrabold transition active:scale-95 shadow-2xl ${
              completed
                ? 'bg-gradient-to-br from-gold via-gold-light to-gold text-white animate-pulse'
                : 'bg-gradient-to-br from-emerald via-emerald-soft to-emerald text-white hover:shadow-emerald/30 hover:shadow-2xl'
            }`}
          >
            <svg className="absolute inset-0 -rotate-90 p-2" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" className="stroke-white/15" strokeWidth="4" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                className={completed ? 'stroke-white' : 'stroke-gold-light'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.25s ease' }}
              />
            </svg>
            <div className="relative flex flex-col items-center">
              <span className="leading-none drop-shadow-lg">{count}</span>
              <span className="text-xs font-bold opacity-70 mt-1 normal-case">انقر للعد</span>
            </div>
          </button>

          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={() => incrementTasbeeh(-1)}
              className="btn-ghost !p-3 rounded-full"
              aria-label="نقص واحد"
            >
              <Minus size={18} />
            </button>
            <button
              onClick={() => incrementTasbeeh(10)}
              className="btn-gold text-sm"
            >
              <Plus size={16} /> +10
            </button>
            <button
              onClick={() => incrementTasbeeh(100)}
              className="btn-primary text-sm"
            >
              +100
            </button>
            <button
              onClick={resetTasbeeh}
              className="btn-ghost !p-3 rounded-full"
              aria-label="تصفير"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {completed && (
            <div className="mt-4 card px-5 py-3 bg-gold/15 border-gold/40 dark:bg-gold/10 animate-scale-in">
              <p className="text-center font-extrabold text-gold-dark dark:text-gold-light text-base">
                ✨ مبارك! لقد أكملت {target} تسبيحة، واصل للحصول على مزيد من الأجر ✨
              </p>
            </div>
          )}
        </div>
      </div>

      <SectionCard title="اختيار الهدف" icon={<Trophy size={18} />}>
        <div className="grid grid-cols-5 gap-2">
          {TARGETS.map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`rounded-xl py-3 text-sm font-extrabold transition active:scale-95 ${
                target === t
                  ? 'bg-emerald text-white dark:bg-gold shadow-lg'
                  : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-700 dark:text-slate-200 hover:bg-emerald/10 dark:hover:bg-gold/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="إحصائياتك" icon={<Trophy size={18} />} className="border-gold/30 bg-gold/5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="text-center p-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">الأيام المتتالية</p>
            <p className="text-2xl font-extrabold text-gold-dark dark:text-gold-light mt-1">{stats.streak}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">في وقتها</p>
            <p className="text-2xl font-extrabold text-emerald mt-1">{stats.totalPrayersOnTime}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">متأخرة</p>
            <p className="text-2xl font-extrabold text-gold-dark mt-1">{stats.totalPrayersLate}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">صفحات القرآن</p>
            <p className="text-2xl font-extrabold text-emerald mt-1">{stats.totalPagesRead}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
