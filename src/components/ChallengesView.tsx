import { useState, useMemo } from 'react';
import {
  User,
  Users,
  Flame,
  Award,
  PiggyBank,
  Plus,
  Trophy,
  Crown,
  LogOut,
  Copy,
  Check,
  Target,
  TrendingUp,
  Gift,
  BookOpen,
  CalendarCheck,
  Star,
  Trash2,
  Sparkles,
  DollarSign,
  Coins,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SectionCard, EmptyState, Modal } from '@/components/ui';
import type { Reward } from '@/types';

type Mode = 'solo' | 'family';

export default function ChallengesView() {
  const [mode, setMode] = useState<Mode>('solo');

  return (
    <div className="p-4 pb-24 animate-fade-in">
      <div className="mb-4 rounded-xl bg-emerald dark:bg-emerald-soft/40 p-1">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('solo')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold transition ${
              mode === 'solo'
                ? 'bg-white dark:bg-emerald-deep text-emerald dark:text-gold-light shadow'
                : 'text-white/80 dark:text-slate-300'
            }`}
          >
            <User size={16} /> التحدي الفردي
          </button>
          <button
            onClick={() => setMode('family')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold transition ${
              mode === 'family'
                ? 'bg-white dark:bg-emerald-deep text-emerald dark:text-gold-light shadow'
                : 'text-white/80 dark:text-slate-300'
            }`}
          >
            <Users size={16} /> عائلة توبة
          </button>
        </div>
      </div>

      {mode === 'solo' ? <SoloMode /> : <FamilyMode />}
    </div>
  );
}

function SoloMode() {
  const { stats, tracking, addCharity, soloRewards, addSoloReward, removeSoloReward, redeemSoloReward } = useApp();
  const [showDonate, setShowDonate] = useState(false);
  const [donateAmt, setDonateAmt] = useState(10);
  const [showRewardAdd, setShowRewardAdd] = useState(false);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardAmount, setRewardAmount] = useState(10);
  const [rewardTarget, setRewardTarget] = useState(5);
  const [rewardType, setRewardType] = useState<Reward['type']>('prayer_all');

  const totalPrayers = stats.totalPrayersOnTime + stats.totalPrayersLate + stats.totalPrayersMissed;
  const onTimeRate = totalPrayers > 0 ? Math.round((stats.totalPrayersOnTime / totalPrayers) * 100) : 0;

  const todayDone = (['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).filter(
    (k) => tracking[k] !== 'missed'
  ).length;

  const BADGES = [
    { id: 'first_prayer', label: 'أول صلاة', icon: '🌟', desc: 'صلِّ أول صلاة' },
    { id: 'streak_3', label: '٣ أيام متتالية', icon: '🔥', desc: 'التزم ٣ أيام' },
    { id: 'streak_7', label: 'أسبوع كامل', icon: '⭐', desc: 'التزم ٧ أيام' },
    { id: 'first_charity', label: 'صدقة أولى', icon: '🤲', desc: 'تبرّع أول مرة' },
    { id: 'اليوم الكامل', label: 'يوم كامل', icon: '💎', desc: 'صلّ جميع الصلوات في وقتها' },
  ];

  const ownedBadges = stats.badges;
  const earnedBadgeIds = new Set(ownedBadges);
  if (stats.totalPrayersOnTime >= 1) earnedBadgeIds.add('first_prayer');
  if (stats.streak >= 3) earnedBadgeIds.add('streak_3');
  if (stats.streak >= 7) earnedBadgeIds.add('streak_7');
  if (stats.personalCharity > 0) earnedBadgeIds.add('first_charity');

  const handleAddReward = () => {
    if (!rewardTitle.trim()) return;
    addSoloReward({
      title: rewardTitle.trim(),
      description: rewardDesc.trim(),
      type: rewardType,
      target: rewardTarget,
      amount: rewardAmount,
      currency: 'ج.م',
    });
    setRewardTitle('');
    setRewardDesc('');
    setRewardAmount(10);
    setRewardTarget(5);
    setShowRewardAdd(false);
  };

  const rewardTypeLabel: Record<Reward['type'], string> = {
    prayer_all: 'كل الصلوات',
    prayer_on_time: 'في وقتها',
    quran_pages: 'صفحات قرآن',
    streak: 'أيام متتالية',
    custom: 'مخصص',
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-gold/15 to-transparent p-5 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-gold/20">
            <Flame size={32} className="text-gold-dark dark:text-gold-light" />
          </div>
          <p className="text-4xl font-extrabold text-emerald dark:text-gold-light">{stats.streak}</p>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">سلسلة الالتزام (أيام)</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 dark:divide-emerald-soft/30 border-t border-slate-100 dark:border-emerald-soft/30">
          <Stat label="في وقتها" value={stats.totalPrayersOnTime} color="text-emerald dark:text-gold-light" />
          <Stat label="متأخرة" value={stats.totalPrayersLate} color="text-gold" />
          <Stat label="فاتتني" value={stats.totalPrayersMissed} color="text-red-500" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          icon={<CalendarCheck size={24} />}
          title="صلاة اليوم"
          value={`${todayDone}/5`}
          sub={`${Math.round((todayDone / 5) * 100)}%`}
          progress={(todayDone / 5) * 100}
        />
        <StatCard
          icon={<BookOpen size={24} />}
          title="صفحات اليوم"
          value={`${stats.pagesReadToday}`}
          sub={`إجمالي: ${stats.totalPagesRead}`}
          progress={Math.min(100, (stats.pagesReadToday / 10) * 100)}
        />
      </div>

      <SectionCard
        title="حصالتي الشخصية"
        icon={<PiggyBank size={18} />}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowRewardAdd(true)}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              <Gift size={14} /> جائزة
            </button>
            <button onClick={() => setShowDonate(true)} className="btn-gold px-3 py-1.5 text-xs">
              <Plus size={14} /> أضف
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15 text-3xl"> </div>
          <div className="flex-1">
            <p className="text-3xl font-extrabold text-emerald dark:text-gold-light">
              {stats.personalCharity.toLocaleString('ar-EG')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">ج.م (تتبع شخصي)</p>
          </div>
        </div>

        {soloRewards.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-emerald-soft/30">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
              <Star size={12} /> الجوائز الشخصية:
            </p>
            {soloRewards.map((r) => (
              <RewardRow
                key={r.id}
                reward={r}
                typeLabel={rewardTypeLabel[r.type]}
                canRedeem={!r.redeemedToday}
                onRedeem={() => redeemSoloReward(r.id)}
                onRemove={() => removeSoloReward(r.id)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="الإنجازات" icon={<Award size={18} />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BADGES.map((b) => {
            const earned = earnedBadgeIds.has(b.id);
            return (
              <div
                key={b.id}
                className={`flex flex-col items-center gap-1 rounded-xl p-3 text-center transition ${
                  earned
                    ? 'bg-gold/10 border border-gold/30'
                    : 'bg-slate-50 dark:bg-emerald-deep/40 border border-slate-200 dark:border-emerald-soft/20 opacity-60'
                }`}
              >
                <span className={`text-2xl ${earned ? '' : 'grayscale'}`}>{b.icon}</span>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{b.label}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="نسبة الالتزام" icon={<TrendingUp size={18} />}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">نسبة الصلاة في وقتها</p>
          <p className="text-2xl font-extrabold text-emerald dark:text-gold-light">{onTimeRate}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-soft/30">
          <div
            className="h-full rounded-full bg-emerald transition-all"
            style={{ width: `${onTimeRate}%` }}
          />
        </div>
      </SectionCard>

      <Modal open={showDonate} onClose={() => setShowDonate(false)} title="أضف إلى حصالتك">
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">حدّد مبلغ الصدقة الذي تريد تتبعه:</p>
          <div className="flex gap-2">
            {[5, 10, 20, 50, 100].map((a) => (
              <button
                key={a}
                onClick={() => setDonateAmt(a)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                  donateAmt === a
                    ? 'bg-emerald text-white dark:bg-gold'
                    : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              addCharity(donateAmt);
              setShowDonate(false);
            }}
            className="btn-gold w-full"
          >
            <PiggyBank size={16} /> أضف {donateAmt} ريال
          </button>
        </div>
      </Modal>

      <Modal open={showRewardAdd} onClose={() => setShowRewardAdd(false)} title="جائزة شخصية جديدة">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">عنوان الجائزة</label>
            <input
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
              placeholder="مثال: تخرج مع العائلة"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">وصف مختصر</label>
            <input
              value={rewardDesc}
              onChange={(e) => setRewardDesc(e.target.value)}
              placeholder="مثال: بعد أسبوع كامل من الالتزام"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">نوع الجائزة</label>
            <select value={rewardType} onChange={(e) => setRewardType(e.target.value as Reward['type'])} className="input">
              {(Object.keys(rewardTypeLabel) as Reward['type'][]).map((t) => (
                <option key={t} value={t}>{rewardTypeLabel[t]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">الهدف</label>
              <input
                type="number"
                min={1}
                value={rewardTarget}
                onChange={(e) => setRewardTarget(Math.max(1, Number(e.target.value)))}
                className="input text-center font-bold"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">القيمة (ج.م)</label>
              <input
                type="number"
                min={1}
                value={rewardAmount}
                onChange={(e) => setRewardAmount(Math.max(1, Number(e.target.value)))}
                className="input text-center font-bold"
              />
            </div>
          </div>
          <button onClick={handleAddReward} className="btn-primary w-full">
            <Gift size={16} /> إضافة الجائزة
          </button>
        </div>
      </Modal>
    </div>
  );
}

function RewardRow({
  reward,
  typeLabel,
  canRedeem,
  onRedeem,
  onRemove,
  isAdmin,
  memberCount,
  onRedeemMember,
}: {
  reward: Reward;
  typeLabel: string;
  canRedeem: boolean;
  onRedeem?: () => void;
  onRemove?: () => void;
  isAdmin?: boolean;
  memberCount?: number;
  onRedeemMember?: (memberId: string) => void;
}) {
  const { family, profile } = useApp();
  const [showMembers, setShowMembers] = useState(false);
  const members = Array.isArray(family?.members) ? family.members : [];
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-emerald-deep/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-slate-800 dark:text-slate-100">{reward.title}</p>
            <span className="pill bg-emerald/15 text-emerald dark:bg-gold/15 dark:text-gold-light text-[10px]">
              {typeLabel} · {reward.target}
            </span>
          </div>
          {reward.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{reward.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">القيمة:</span>
            <span className="font-bold text-gold-dark dark:text-gold-light text-sm flex items-center gap-1">
              <Coins size={12} /> {reward.amount.toLocaleString('ar-EG')} {reward.currency}
            </span>
            {reward.redeemedToday && (
              <span className="pill bg-emerald/15 text-emerald dark:bg-emerald-soft/30 dark:text-gold-light text-[10px]">
                <Check size={10} /> تم اليوم
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {isAdmin && memberCount && memberCount > 0 ? (
            <button
              onClick={() => setShowMembers(true)}
              disabled={!canRedeem}
              className="btn-gold px-2 py-1 text-xs whitespace-nowrap disabled:opacity-50"
            >
              <Gift size={12} /> استلام
            </button>
          ) : onRedeem ? (
            <button
              onClick={onRedeem}
              disabled={!canRedeem}
              className="btn-gold px-2 py-1 text-xs whitespace-nowrap disabled:opacity-50"
            >
              <Gift size={12} /> استلام
            </button>
          ) : null}
          {onRemove && (
            <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1 self-end">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {isAdmin && showMembers && family && onRedeemMember && (
        <Modal open={showMembers} onClose={() => setShowMembers(false)} title="اختر العضو المستلم">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
            <Info size={12} /> سيتم خصم القيمة من حصالة العائلة واضافتها لنقاط العضو: <b>{reward.amount} {reward.currency}</b>
          </p>
          <div className="space-y-2">
            {members.map((m) => {
              const isCurrent = m.name === profile.displayName;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onRedeemMember(m.id);
                    setShowMembers(false);
                  }}
                  className="card flex items-center justify-between p-3 w-full text-right hover:border-gold/40 transition"
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 flex items-center justify-center rounded-full text-xs font-bold text-white ${m.isHead ? 'bg-gold' : 'bg-emerald'}`}>
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        {m.name}
                        {m.isHead && <Crown size={12} className="text-gold" />}
                        {isCurrent && <span className="text-[10px] text-emerald dark:text-gold-light">(أنت)</span>}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{m.points} نقطة</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <p className={`text-xl font-extrabold ${color}`}>{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  sub,
  progress,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
  progress: number;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/10 dark:bg-gold/15 text-emerald dark:text-gold-light">
            {icon}
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{title}</p>
        </div>
      </div>
      <p className="text-2xl font-extrabold text-emerald dark:text-gold-light">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{sub}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-soft/30">
        <div
          className="h-full rounded-full bg-gradient-to-l from-emerald to-gold transition-all"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}

function MemberProgressCard({
  member,
  isCurrent,
}: {
  member: ReturnType<typeof useApp>['family'] extends infer F ? (F extends { members: (infer M)[] } ? M : never) : never;
  isCurrent: boolean;
}) {
  const prayersPct = Math.min(100, (member.prayersToday / 5) * 100);
  const pagesPct = Math.min(100, (member.pagesToday / 10) * 100);
  return (
    <div className={`rounded-xl p-3 border ${isCurrent ? 'border-gold/40 bg-gold/5 dark:bg-gold/10' : 'bg-slate-50 dark:bg-emerald-deep/40 border-slate-200/60 dark:border-emerald-soft/20'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`relative h-12 w-12 flex items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow ${member.isHead ? 'bg-gradient-to-br from-gold to-gold-light' : 'bg-gradient-to-br from-emerald to-emerald-soft'}`}>
          {member.name.charAt(0)}
          {member.isHead && (
            <div className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center rounded-full bg-white dark:bg-emerald-deep shadow">
              <Crown size={12} className="text-gold" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-slate-800 dark:text-slate-100">{member.name}</p>
            {isCurrent && <span className="text-[10px] font-bold text-emerald dark:text-gold-light">(أنت)</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="pill bg-emerald/15 text-emerald dark:bg-gold/15 dark:text-gold-light text-[10px] flex items-center gap-1">
              <Star size={10} /> {member.points} نقطة
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <CalendarCheck size={10} /> صلاة اليوم
            </span>
            <span className="font-bold text-emerald dark:text-gold-light">
              {member.prayersToday} / 5
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-soft/30">
            <div className="h-full rounded-full bg-emerald transition-all" style={{ width: `${prayersPct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <BookOpen size={10} /> صفحات اليوم
            </span>
            <span className="font-bold text-emerald dark:text-gold-light">
              {member.pagesToday}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-soft/30">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pagesPct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-emerald-soft/30 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-lg font-extrabold text-emerald dark:text-gold-light">{member.totalPrayers}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">إجمالي الصلوات</p>
        </div>
        <div>
          <p className="text-lg font-extrabold text-emerald dark:text-gold-light">{member.totalPages}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">إجمالي الصفحات</p>
        </div>
      </div>
    </div>
  );
}

function FamilyMode() {
  const { family: rawFamily, profile, createFamily, joinFamily, leaveFamily, addFamilyDonation, addFamilyReward, removeFamilyReward, redeemFamilyReward, isCloudSync } = useApp();
  const family = rawFamily && typeof rawFamily === 'object' ? rawFamily : null;
  const members = Array.isArray(family?.members) ? family.members : [];
  const rewards = Array.isArray(family?.rewards) ? family.rewards : [];
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [donateAmt, setDonateAmt] = useState(10);
  const [showDonate, setShowDonate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardAmount, setRewardAmount] = useState(10);
  const [rewardTarget, setRewardTarget] = useState(5);
  const [rewardType, setRewardType] = useState<Reward['type']>('prayer_all');
  const [refreshing, setRefreshing] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const copyCode = () => {
    if (!family) return;
    navigator.clipboard?.writeText(family.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const familyTotals = useMemo(() => {
    if (!family) return { totalPrayersToday: 0, totalPagesToday: 0, totalPrayersAll: 0, totalPagesAll: 0, possiblePrayersToday: 0 };
    let tp = 0, tpg = 0, tpa = 0, tpga = 0;
    for (const m of members) {
      tp += m.prayersToday || 0;
      tpg += m.pagesToday || 0;
      tpa += m.totalPrayers || 0;
      tpga += m.totalPages || 0;
    }
    return {
      totalPrayersToday: tp,
      totalPagesToday: tpg,
      totalPrayersAll: tpa,
      totalPagesAll: tpga,
      possiblePrayersToday: members.length * 5,
    };
  }, [family, members]);

  const headMember = useMemo(() => members.find((m) => m.isHead), [members]);
  const isAdmin = !!headMember && !!family && (headMember.name === profile.displayName || headMember.id === members.find((m) => m.name === profile.displayName)?.id);
  const currentUserMemberId = useMemo(() => {
    if (!family) return null;
    const m = members.find((mm) => mm.name === profile.displayName);
    return m?.id ?? null;
  }, [family, members, profile.displayName]);

  const handleAddReward = () => {
    if (!rewardTitle.trim()) return;
    addFamilyReward({
      title: rewardTitle.trim(),
      description: rewardDesc.trim(),
      type: rewardType,
      target: rewardTarget,
      amount: rewardAmount,
      currency: family?.currency || 'ج.م',
    });
    setRewardTitle('');
    setRewardDesc('');
    setRewardAmount(10);
    setRewardTarget(5);
    setShowAddReward(false);
  };

  const rewardTypeLabel: Record<Reward['type'], string> = {
    prayer_all: 'كل الصلوات',
    prayer_on_time: 'في وقتها',
    quran_pages: 'صفحات قرآن',
    streak: 'أيام متتالية',
    custom: 'مخصص',
  };

  if (!family) {
    return (
      <div className="space-y-4">
        <SectionCard title="عائلة توبة" icon={<Users size={18} />}>
          <EmptyState
            icon={<Users size={40} />}
            title="انضم إلى عائلتك في رحلة الالتزام"
            description="أنشئ مجموعة عائلية أو انضم برمز الدعوة، وتنافسوا في الخير واجمعوا صدقاتكم معاً"
          />
        </SectionCard>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setShowCreate(true)} className="card flex flex-col items-center gap-2 p-6 transition hover:border-emerald/40 hover:shadow-md active:scale-[0.98]">
            <Users size={32} className="text-emerald dark:text-gold-light" />
            <p className="font-bold text-slate-800 dark:text-slate-100">إنشاء عائلة</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">ابدأ مجموعة جديدة وادعُ أفراد عائلتك</p>
          </button>
          <button onClick={() => setShowJoin(true)} className="card flex flex-col items-center gap-2 p-6 transition hover:border-emerald/40 hover:shadow-md active:scale-[0.98]">
            <User size={32} className="text-emerald dark:text-gold-light" />
            <p className="font-bold text-slate-800 dark:text-slate-100">انضمام برمز</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">لديك رمز دعوة من ولي الأمر؟</p>
          </button>
        </div>

        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="إنشاء عائلة جديدة">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">اسم العائلة</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عائلة الحسين" className="input" />
            </div>
            <button
              onClick={() => {
                if (name.trim()) {
                  createFamily(name.trim());
                  setShowCreate(false);
                  setName('');
                }
              }}
              className="btn-primary w-full"
            >
              <Users size={16} /> إنشاء
            </button>
          </div>
        </Modal>

        <Modal open={showJoin} onClose={() => { setShowJoin(false); setJoinError(null); }} title="انضمام برمز الدعوة">
          <div className="space-y-3">
            {joinError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                {joinError}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold">رمز الدعوة</label>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setJoinError(null); }}
                placeholder="مثال: AB123"
                className="input text-center font-mono text-lg tracking-widest"
                maxLength={6}
              />
            </div>
            <button
              onClick={async () => {
                if (code.trim().length >= 4) {
                  try {
                    await joinFamily(code.trim());
                    setShowJoin(false);
                    setCode('');
                    setJoinError(null);
                  } catch (e) {
                    setJoinError('تعذّر الانضمام. تحقق من الرمز وحاول مجدداً.');
                  }
                } else {
                  setJoinError('الرمز يجب أن يكون ٤ أحرف على الأقل.');
                }
              }}
              className="btn-primary w-full"
            >
              <User size={16} /> انضمام
            </button>
            {!isCloudSync && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                ⚠️ وضع عدم الاتصال: سيتم إنشاء عائلة محلية فقط
              </p>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => b.points - a.points);

  const refreshFamily = async () => {
    if (!isCloudSync || !family?.id) return;
    setRefreshing(true);
    try {
      const { fetchFamilyMembers: ffMembers, fetchFamilyRewards: ffRewards } = await import('@/lib/supabase');
      const [newMembers, newRewards] = await Promise.all([
        ffMembers(family.id).catch(() => []),
        ffRewards(family.id).catch(() => []),
      ]);
      setFamily((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          members: Array.isArray(newMembers) && newMembers.length ? newMembers : cur.members,
          rewards: Array.isArray(newRewards) ? newRewards : cur.rewards,
        };
      });
    } catch {
      // ignore refresh errors
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-emerald to-emerald-deep p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold">{family.name}</h2>
                <p className="text-sm text-emerald-100">{members.length} أعضاء</p>
              </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshFamily}
                disabled={refreshing || !isCloudSync}
                className="rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 transition hover:bg-white/25 active:scale-95"
                title="تحديث البيانات"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin inline' : 'inline'} />
              </button>
              <button onClick={copyCode} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25 transition">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {family.code}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-slate-100 dark:divide-emerald-soft/30 border-t border-slate-100 dark:border-emerald-soft/30">
          <div className="p-3 text-center">
            <p className="text-2xl font-extrabold text-emerald dark:text-gold-light">
              {familyTotals.totalPrayersToday}
              <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">/{familyTotals.possiblePrayersToday}</span>
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">صلوات اليوم</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-2xl font-extrabold text-emerald dark:text-gold-light">{familyTotals.totalPagesToday}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">صفحات اليوم</p>
          </div>
          <div className="p-3 text-center border-t-2 sm:border-t-0 border-slate-100 dark:border-emerald-soft/30">
            <p className="text-2xl font-extrabold text-slate-600 dark:text-slate-200">{familyTotals.totalPrayersAll}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">إجمالي الصلوات</p>
          </div>
          <div className="p-3 text-center border-t-2 sm:border-t-0 border-slate-100 dark:border-emerald-soft/30">
            <p className="text-2xl font-extrabold text-slate-600 dark:text-slate-200">{familyTotals.totalPagesAll}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">إجمالي الصفحات</p>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-emerald-soft/30 px-3 py-2">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">إنجاز العائلة اليوم (صلوات)</span>
            <span className="text-emerald dark:text-gold-light font-bold">
              {familyTotals.possiblePrayersToday > 0
                ? Math.round((familyTotals.totalPrayersToday / familyTotals.possiblePrayersToday) * 100)
                : 0}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-soft/30">
            <div
              className="h-full rounded-full bg-gradient-to-l from-emerald via-emerald-soft to-gold transition-all duration-700"
              style={{
                width: `${
                  familyTotals.possiblePrayersToday > 0
                    ? Math.min(100, (familyTotals.totalPrayersToday / familyTotals.possiblePrayersToday) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
        <button onClick={leaveFamily} className="w-full border-t border-slate-100 dark:border-emerald-soft/30 py-2 text-xs font-semibold text-red-500 flex items-center justify-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
          <LogOut size={12} /> مغادرة العائلة
        </button>
      </div>

      <SectionCard
        title="حصالة العائلة 🏦"
        icon={<PiggyBank size={18} />}
        action={
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={() => setShowAddReward(true)} className="btn-primary px-3 py-1.5 text-xs">
                <Gift size={14} /> جائزة
              </button>
            )}
            <button onClick={() => setShowDonate(true)} className="btn-gold px-3 py-1.5 text-xs">
              <Plus size={14} /> تبرّع
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15 text-3xl">🏦</div>
          <div className="flex-1">
            <p className="text-3xl font-extrabold text-emerald dark:text-gold-light">
              {family.treasury.toLocaleString('ar-EG')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{family.currency} · تبرعات العائلة الجماعية</p>
          </div>
        </div>

        {rewards.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-emerald-soft/30">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Sparkles size={12} /> جوائز العائلة:
            </p>
            {rewards.map((r) => (
              <RewardRow
                key={r.id}
                reward={r}
                typeLabel={rewardTypeLabel[r.type]}
                canRedeem={!r.redeemedToday}
                isAdmin={isAdmin}
                memberCount={members.length}
                onRemove={isAdmin ? () => removeFamilyReward(r.id) : undefined}
                onRedeemMember={(mid) => redeemFamilyReward(mid, r.id)}
                onRedeem={!isAdmin && currentUserMemberId ? () => redeemFamilyReward(currentUserMemberId, r.id) : undefined}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="تقدم أفراد العائلة" icon={<Target size={18} />}>
        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <MemberProgressCard
              key={m.id}
              member={m as any}
              isCurrent={m.name === profile.displayName}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="لوحة المتصدرين" icon={<Trophy size={18} />}>
        <div className="space-y-2">
          {sorted.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-xl p-3 ${
                i === 0
                  ? 'bg-gold/10 border border-gold/30'
                  : 'bg-slate-50 dark:bg-emerald-deep/40'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                i === 0 ? 'bg-gold text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 dark:bg-emerald-soft/40 text-slate-600 dark:text-slate-300'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  {m.name}
                  {m.isHead && <Crown size={14} className="text-gold" />}
                  {m.name === profile.displayName && <span className="text-xs text-emerald dark:text-gold-light">(أنت)</span>}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  <CalendarCheck size={10} className="inline mx-0.5" /> {m.prayersToday}/5 ·
                  <BookOpen size={10} className="inline mx-0.5" /> {m.pagesToday} صفحات
                </p>
              </div>
              <p className="font-extrabold text-emerald dark:text-gold-light">{m.points}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">نقطة</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          تُحتسب النقاط من الصلوات في وقتها (10 نقاط) وصفحات القرآن (2 نقاط)
        </p>
      </SectionCard>

      <Modal open={showDonate} onClose={() => setShowDonate(false)} title="أضف إلى حصالة العائلة">
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <DollarSign size={16} className="text-gold" /> المبلغ سيضاف مباشرة إلى حصالة العائلة الجماعية:
          </p>
          <div className="flex gap-2">
            {[5, 10, 20, 50, 100].map((a) => (
              <button
                key={a}
                onClick={() => setDonateAmt(a)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                  donateAmt === a
                    ? 'bg-emerald text-white dark:bg-gold'
                    : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              addFamilyDonation(donateAmt);
              setShowDonate(false);
            }}
            className="btn-gold w-full"
          >
            <PiggyBank size={16} /> تبرّع بـ {donateAmt} {family.currency}
          </button>
        </div>
      </Modal>

      <Modal open={showAddReward} onClose={() => setShowAddReward(false)} title="جائزة عائلية جديدة (ولي الأمر)">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">عنوان الجائزة</label>
            <input
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
              placeholder="مثال: صلاة الفجر في المسجد"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">وصف مختصر</label>
            <input
              value={rewardDesc}
              onChange={(e) => setRewardDesc(e.target.value)}
              placeholder="مثال: 10 جنيه مصري لمن يحقق الشرط"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">نوع الجائزة</label>
            <select value={rewardType} onChange={(e) => setRewardType(e.target.value as Reward['type'])} className="input">
              {(Object.keys(rewardTypeLabel) as Reward['type'][]).map((t) => (
                <option key={t} value={t}>{rewardTypeLabel[t]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">الهدف</label>
              <input
                type="number"
                min={1}
                value={rewardTarget}
                onChange={(e) => setRewardTarget(Math.max(1, Number(e.target.value)))}
                className="input text-center font-bold"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">القيمة ({family.currency})</label>
              <input
                type="number"
                min={1}
                value={rewardAmount}
                onChange={(e) => setRewardAmount(Math.max(1, Number(e.target.value)))}
                className="input text-center font-bold"
              />
            </div>
          </div>
          <button onClick={handleAddReward} className="btn-primary w-full">
            <Gift size={16} /> إضافة الجائزة
          </button>
        </div>
      </Modal>
    </div>
  );
}
