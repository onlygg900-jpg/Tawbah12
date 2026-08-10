import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  AppSettings,
  UserProfile,
  PrayerTracking,
  SoloStats,
  FamilyGroup,
  FamilyMember,
  QuranKhatma,
  TasbeehCount,
  Reward,
} from '@/types';
import { loadState, saveState, todayKey, localDateKey } from '@/services/storage';
import { defaultNotificationSettings } from '@/services/notificationService';
import { PRAYER_KEYS, detectLocation, type LocationCoords } from '@/services/prayerService';
import { schedulePrayerChecks } from '@/services/notificationService';
import {
  isSupabaseAvailable,
  insertFamily,
  fetchFamilyByCode,
  fetchFamilyByUserId,
  updateFamilyTreasury,
  upsertMember,
  insertReward,
  updateReward,
  deleteReward,
  upsertDailyProgress,
  fetchFamilyRewards,
  fetchFamilyMembers,
  signUpWithEmail,
  signInWithEmail,
  signInAsGuest,
  signOutCurrent,
  getCurrentSessionUserId,
  readLocalProfile,
  signInWithGoogle,
  subscribeAuthChanges,
  fetchCurrentSession,
  fetchDailyProgress,
  handleOAuthRedirect,
} from '@/lib/supabase';
import { generateUUID } from '@/utils/uuid';

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleTheme: () => void;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  signInEmail: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  signUpEmail: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  signInGuest: (name?: string) => Promise<void>;
  signInGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  userId: string;
  authenticated: boolean;
  authLoading: boolean;
  tracking: PrayerTracking;
  setPrayerStatus: (key: (typeof PRAYER_KEYS)[number], status: PrayerTracking['Fajr']) => void;
  tasbeeh: TasbeehCount;
  incrementTasbeeh: (by?: number) => void;
  resetTasbeeh: () => void;
  stats: SoloStats;
  addCharity: (amount: number) => void;
  addQuranPages: (pages: number) => void;
  soloRewards: Reward[];
  addSoloReward: (r: Omit<Reward, 'id' | 'redeemedToday' | 'lastRedeemedDate'>) => void;
  removeSoloReward: (id: string) => void;
  redeemSoloReward: (id: string) => void;
  khatmas: QuranKhatma[];
  addKhatma: (name: string, dailyTarget: number) => void;
  updateKhatmaPage: (id: string, page: number) => void;
  removeKhatma: (id: string) => void;
  family: FamilyGroup | null;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (code: string) => Promise<void>;
  leaveFamily: () => void;
  addFamilyDonation: (amount: number) => void;
  addFamilyReward: (r: Omit<Reward, 'id' | 'redeemedToday' | 'lastRedeemedDate'>) => void;
  removeFamilyReward: (id: string) => void;
  redeemFamilyReward: (memberId: string, rewardId: string) => void;
  updateMemberStat: (memberId: string, patch: Partial<FamilyMember>) => void;
  refreshFamily: () => Promise<void>;
  isCurrentMember: (m: Partial<FamilyMember>) => boolean;
  prayers: Array<{ key: string; label: string; time: string }>;
  setPrayers: (p: Array<{ key: string; label: string; time: string }>) => void;
  location: LocationCoords | null;
  setLocation: (loc: LocationCoords) => void;
  detecting: boolean;
  reDetectLocation: () => Promise<void>;
  isCloudSync: boolean;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  city: 'مكة',
  country: 'السعودية',
  calcMethod: 4,
  notifications: defaultNotificationSettings(),
  contentBlocker: { enabled: false, provider: 'none', adminLocked: false, adminPin: null, nativeVpnEnabled: false, nativeVpnProvider: 'none' },
};

const defaultProfile: UserProfile = {
  displayName: 'ضيف توبة',
  email: '',
  avatarColor: '#d97706',
  loggedIn: false,
};

const defaultStats: SoloStats = {
  streak: 0,
  totalPrayersOnTime: 0,
  totalPrayersLate: 0,
  totalPrayersMissed: 0,
  personalCharity: 0,
  pagesReadToday: 0,
  totalPagesRead: 0,
  badges: [],
  lastCompletedDate: null,
};

const AppContext = createContext<AppContextValue | null>(null);

function safeArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

function safeFamilyGroup(value: unknown): FamilyGroup | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (!obj.id || typeof obj.id !== 'string') return null;
  return {
    id: obj.id,
    name: typeof obj.name === 'string' ? obj.name : 'عائلة توبة',
    code: typeof obj.code === 'string' ? obj.code : 'LOCAL',
    currency: typeof obj.currency === 'string' ? obj.currency : 'ج.م',
    treasury: typeof obj.treasury === 'number' ? obj.treasury : 0,
    members: safeArray<FamilyMember>(obj.members, []),
    rewards: safeArray<Reward>(obj.rewards, []),
  };
}

function isCurrentFamilyMember(member: FamilyMember, userId: string, displayName: string, isCloud: boolean): boolean {
  if (isCloud && (member.userId || userId)) {
    return !!member.userId && member.userId === userId;
  }
  return member.userId === userId
    || member.id === userId
    || (!!displayName && member.name === displayName);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadState('settings', defaultSettings));
  const [profile, setProfile] = useState<UserProfile>(() => loadState('profile', defaultProfile));
  const [tracking, setTracking] = useState<PrayerTracking>(() => loadState('tracking', emptyTracking()));
  const [tasbeeh, setTasbeeh] = useState<TasbeehCount>(() => loadState('tasbeeh', { date: todayKey(), count: 0 }));
  const [stats, setStats] = useState<SoloStats>(() => loadState('stats', defaultStats));
  const [soloRewards, setSoloRewards] = useState<Reward[]>(() => safeArray<Reward>(loadState<unknown>('soloRewards', []), []));
  const [khatmas, setKhatmas] = useState<QuranKhatma[]>(() => safeArray<QuranKhatma>(loadState<unknown>('khatmas', []), []));
  const [family, setFamily] = useState<FamilyGroup | null>(() => safeFamilyGroup(loadState<unknown>('family', null)));
  const [prayers, setPrayers] = useState<Array<{ key: string; label: string; time: string }>>([]);
  const [location, setLocationState] = useState<LocationCoords | null>(() => loadState<LocationCoords | null>('location', null));
  const [detecting, setDetecting] = useState(false);
  const [isCloudSync] = useState<boolean>(isSupabaseAvailable());
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(() => loadState('profile', defaultProfile).loggedIn);

  useEffect(() => { saveState('location', location); }, [location]);

  const reDetectLocation = useCallback(async () => {
    setDetecting(true);
    const loc = await detectLocation();
    setLocationState(loc);
    setDetecting(false);
  }, []);

  useEffect(() => {
    if (!location) {
      reDetectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#052e23' : '#064e3b');
  }, [settings.theme]);

  useEffect(() => saveState('settings', settings), [settings]);
  useEffect(() => saveState('profile', profile), [profile]);
  useEffect(() => saveState('tracking', tracking), [tracking]);
  useEffect(() => saveState('tasbeeh', tasbeeh), [tasbeeh]);
  useEffect(() => saveState('stats', stats), [stats]);
  useEffect(() => saveState('soloRewards', soloRewards), [soloRewards]);
  useEffect(() => saveState('khatmas', khatmas), [khatmas]);
  useEffect(() => saveState('family', family), [family]);

  useEffect(() => {
    const rolloverIfNeeded = () => {
      const tk = todayKey();
      setTracking((t) => (t.date !== tk ? emptyTracking() : t));
      setTasbeeh((t) => (t.date !== tk ? { date: tk, count: 0 } : t));
    };
    rolloverIfNeeded();
    const intervalId = window.setInterval(rolloverIfNeeded, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const totalPrayersOnTime = PRAYER_KEYS.filter((k) => tracking[k] === 'on_time').length;
    const totalPrayersLate = PRAYER_KEYS.filter((k) => tracking[k] === 'late').length;
    const totalPrayersMissed = PRAYER_KEYS.filter((k) => tracking[k] === 'missed').length;
    setStats((s) => {
      if (
        s.totalPrayersOnTime === totalPrayersOnTime &&
        s.totalPrayersLate === totalPrayersLate &&
        s.totalPrayersMissed === totalPrayersMissed
      ) {
        return s;
      }
      return {
        ...s,
        totalPrayersOnTime,
        totalPrayersLate,
        totalPrayersMissed,
      };
    });
  }, [tracking]);

  useEffect(() => {
    if (!settings.notifications.enabled || !settings.notifications.prayerReminders) return;
    const cleanup = schedulePrayerChecks(() => prayers, true);
    return cleanup;
  }, [settings.notifications.enabled, settings.notifications.prayerReminders, prayers]);

  const [userId, setUserIdState] = useState<string>(() => {
    const key = 'tawbah:userid';
    let id = localStorage.getItem(key);
    if (id) return id;
    const local = readLocalProfile();
    if (local?.id) return local.id;
    const fresh = generateUUID();
    localStorage.setItem(key, fresh);
    return fresh;
  });

  useEffect(() => {
    let isMounted = true;
    const authTimeout = window.setTimeout(() => {
      if (isMounted) {
        setAuthLoading(false);
      }
    }, 4000);

    localStorage.setItem('tawbah:userid', userId);
    const local = readLocalProfile();
    if (local && !profile.loggedIn) {
      setProfile((p) => ({
        ...p,
        displayName: local.display_name || p.displayName,
        email: local.email || p.email,
        avatarColor: local.avatar_color || p.avatarColor,
        loggedIn: true,
      }));
      setAuthenticated(true);
    }
    if (isCloudSync) {
      void (async () => {
        try {
          await handleOAuthRedirect();
        } catch {
          // ignore redirect parsing errors
        }
        try {
          const sessionUser = await fetchCurrentSession();
          if (sessionUser) {
            setUserIdState((old) => old || sessionUser.id);
            setProfile((p) => ({
              ...p,
              displayName: sessionUser.displayName || p.displayName,
              email: sessionUser.email || p.email,
              avatarColor: sessionUser.avatarColor || p.avatarColor,
              avatarUrl: sessionUser.avatarUrl,
              loggedIn: true,
            }));
            setAuthenticated(true);
            try {
              const dbStats = await fetchDailyProgress(sessionUser.id, todayKey());
              if (dbStats && typeof dbStats === 'object') {
                setStats((s) => {
                  const next: typeof s = { ...s };
                  if (typeof dbStats.streak === 'number' && dbStats.streak > next.streak) next.streak = dbStats.streak;
                  if (typeof dbStats.totalPrayersOnTime === 'number') next.totalPrayersOnTime = Math.max(next.totalPrayersOnTime, dbStats.totalPrayersOnTime);
                  if (typeof dbStats.totalPrayersLate === 'number') next.totalPrayersLate = Math.max(next.totalPrayersLate, dbStats.totalPrayersLate);
                  if (typeof dbStats.totalPrayersMissed === 'number') next.totalPrayersMissed = Math.max(next.totalPrayersMissed, dbStats.totalPrayersMissed);
                  if (typeof dbStats.totalPagesRead === 'number') next.totalPagesRead = Math.max(next.totalPagesRead, dbStats.totalPagesRead);
                  if (typeof dbStats.pagesReadToday === 'number') next.pagesReadToday = Math.max(next.pagesReadToday, dbStats.pagesReadToday);
                  if (typeof dbStats.personalCharity === 'number') next.personalCharity = Math.max(next.personalCharity, dbStats.personalCharity);
                  if (dbStats.lastCompletedDate) next.lastCompletedDate = dbStats.lastCompletedDate || next.lastCompletedDate;
                  return next;
                });
              }
            } catch (e) {
              console.error('fetchDailyProgress session error:', e);
            }
            try {
              const { fetchTasbeehForToday } = await import('@/lib/supabase');
              if (fetchTasbeehForToday) {
                const tCount = await fetchTasbeehForToday(sessionUser.id, todayKey());
                if (typeof tCount === 'number' && tCount >= 0) {
                  setTasbeeh({ date: todayKey(), count: tCount });
                }
              }
            } catch (e) {
              console.error('tasbeeh fetch error:', e);
            }
            try {
              const remoteFamily = await fetchFamilyByUserId(sessionUser.id);
              if (remoteFamily) {
                setFamily(remoteFamily);
              }
            } catch {
              // ignore family lookup failures
            }
          }
        } catch {
          // ignore session fetch failures; local state remains
        } finally {
          if (isMounted) {
            setAuthLoading(false);
          }
          window.clearTimeout(authTimeout);
        }
      })();
    } else {
      const localProf = loadState<UserProfile>('profile', defaultProfile);
      setAuthenticated(localProf.loggedIn);
      setAuthLoading(false);
      window.clearTimeout(authTimeout);
    }

    return () => {
      isMounted = false;
      window.clearTimeout(authTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isCloudSync) return () => {};
    const unsubscribe = subscribeAuthChanges(async (user) => {
      if (user) {
        setUserIdState((old) => old || user.id);
        setProfile((p) => ({
          ...p,
          displayName: user.displayName || p.displayName,
          email: user.email || p.email,
          avatarColor: user.avatarColor || p.avatarColor,
          avatarUrl: user.avatarUrl,
          loggedIn: true,
        }));
        setAuthenticated(true);
        setAuthLoading(false);
        try {
          const remoteFamily = await fetchFamilyByUserId(user.id);
          if (remoteFamily) {
            setFamily(remoteFamily);
          }
        } catch {
          // ignore family lookup failures
        }
      }
    });
    return unsubscribe;
  }, [isCloudSync]);

  useEffect(() => {
    if (isCloudSync && profile.loggedIn) {
      void upsertDailyProgress({ userId, date: todayKey(), stats, tasbeehCount: tasbeeh.count });
    }
  }, [stats, tasbeeh.count, profile.loggedIn, isCloudSync, userId]);

  const signInEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await signInWithEmail(email, password, name || profile.displayName);
      if (res.success) {
        setUserIdState(res.id);
        setProfile((p) => ({
          ...p,
          displayName: res.displayName || p.displayName,
          email: res.email || p.email,
          avatarColor: res.avatarColor || p.avatarColor,
          loggedIn: true,
        }));
        setAuthenticated(true);
      }
      return { ok: res.success, error: res.error };
    },
    [profile.displayName]
  );

  const signUpEmail = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await signUpWithEmail(email, password, name || profile.displayName);
      if (res.success) {
        setUserIdState(res.id);
        setProfile((p) => ({
          ...p,
          displayName: res.displayName || name || p.displayName,
          email: res.email || p.email,
          avatarColor: res.avatarColor || p.avatarColor,
          loggedIn: true,
        }));
        setAuthenticated(true);
      }
      return { ok: res.success, error: res.error };
    },
    [profile.displayName]
  );

  const signInGuest = useCallback(
    async (name?: string) => {
      const res = await signInAsGuest(name || profile.displayName, profile.avatarColor);
      setUserIdState(res.id);
      setProfile((p) => ({
        ...p,
        displayName: res.displayName || name || p.displayName,
        email: res.email || p.email,
        avatarColor: res.avatarColor || p.avatarColor,
        loggedIn: true,
      }));
      setAuthenticated(true);
    },
    [profile.displayName, profile.avatarColor]
  );

  const signInGoogle = useCallback(async () => {
    const res = await signInWithGoogle();
    return { ok: res.success, error: res.error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutCurrent();
    } catch {
      // ignore
    }
    setProfile((p) => ({ ...p, loggedIn: false, avatarUrl: null }));
    setAuthenticated(false);
    localStorage.removeItem('tawbah:userid');
    localStorage.removeItem('tawbah:currentuserid');
    setFamily(null);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((p) => {
      const next = { ...p, ...patch };
      if (isCloudSync) {
        void upsertMember(
          {
            id: userId,
            name: next.displayName,
            points: 0,
            isHead: false,
            prayersToday: 0,
            totalPrayers: stats.totalPrayersOnTime + stats.totalPrayersLate,
            pagesToday: stats.pagesReadToday,
            totalPages: stats.totalPagesRead,
          },
          family?.id || 'local'
        );
      }
      return next;
    });
  }, [isCloudSync, userId, stats, family?.id]);

  const syncFamilyMembers = useCallback(async (fg: FamilyGroup) => {
    if (!isCloudSync) return;
    for (const m of fg.members) {
      void upsertMember(m, fg.id);
    }
    try {
      const dbRewards = await fetchFamilyRewards(fg.id);
      if (Array.isArray(dbRewards) && dbRewards.length) {
        setFamily((cur) => (cur ? { ...cur, rewards: dbRewards } : cur));
      }
    } catch {
      // ignore rewards fetch
    }
    try {
      const dbMembers = await fetchFamilyMembers(fg.id);
      if (Array.isArray(dbMembers) && dbMembers.length) {
        setFamily((cur) => (cur ? { ...cur, members: dbMembers } : cur));
      }
    } catch {
      // ignore members fetch
    }
  }, [isCloudSync]);

  const setPrayerStatus = useCallback(
    (key: (typeof PRAYER_KEYS)[number], status: PrayerTracking['Fajr']) => {
      setTracking((t) => {
        const updated = { ...t, [key]: status };
        const wasMissed = t[key] === 'missed';
        const nowDone = status !== 'missed';
        const becameDone = wasMissed && nowDone;
        const becameMissed = !wasMissed && !nowDone;
        setStats((s) => {
          const today = todayKey();
          const totalPrayersOnTime = PRAYER_KEYS.filter((k) => updated[k] === 'on_time').length;
          const totalPrayersLate = PRAYER_KEYS.filter((k) => updated[k] === 'late').length;
          const totalPrayersMissed = PRAYER_KEYS.filter((k) => updated[k] === 'missed').length;
          const allDone = PRAYER_KEYS.every((k) => updated[k] !== 'missed');
          const allOnTime = PRAYER_KEYS.every((k) => updated[k] === 'on_time');
          const newBadges = [...s.badges];
          if (allOnTime && !newBadges.includes('اليوم الكامل')) newBadges.push('اليوم الكامل');
          const streak = allDone ? (s.lastCompletedDate === yesterdayKey() ? s.streak + 1 : Math.max(1, s.streak)) : s.streak;
          const delta: Partial<SoloStats> = {
            totalPrayersOnTime,
            totalPrayersLate,
            totalPrayersMissed,
          };
          if (allDone && s.lastCompletedDate !== today) delta.lastCompletedDate = today;
          return { ...s, ...delta, streak: allDone ? streak : s.streak, badges: newBadges };
        });
        if (becameDone || becameMissed) {
          setFamily((f) => {
            if (!f) return f;
            const updatedMembers = f.members.map((m) => {
              if (!isCurrentFamilyMember(m, userId, profile.displayName, isCloudSync)) return m;
              const delta = becameDone ? 1 : -1;
              return {
                ...m,
                prayersToday: Math.max(0, m.prayersToday + delta),
                totalPrayers: Math.max(0, m.totalPrayers + delta),
                points: m.points + (becameDone ? 10 : becameMissed ? -10 : 0),
              };
            });
            const next = { ...f, members: updatedMembers };
            if (isCloudSync) {
              for (const mm of updatedMembers) {
                if (isCurrentFamilyMember(mm, userId, profile.displayName, isCloudSync)) {
                  void upsertMember(mm, f.id);
                }
              }
            }
            return next;
          });
        }
        return updated;
      });
    },
    [profile.displayName, isCloudSync, userId]
  );

  const incrementTasbeeh = useCallback((by = 1) => {
    setTasbeeh((t) => ({ date: todayKey(), count: t.count + by }));
  }, []);

  const resetTasbeeh = useCallback(() => setTasbeeh({ date: todayKey(), count: 0 }), []);

  const addCharity = useCallback((amount: number) => {
    setStats((s) => ({ ...s, personalCharity: s.personalCharity + amount }));
  }, []);

  const addQuranPages = useCallback((pages: number) => {
    setStats((s) => ({
      ...s,
      pagesReadToday: s.pagesReadToday + pages,
      totalPagesRead: s.totalPagesRead + pages,
    }));
    setFamily((f) => {
      if (!f) return f;
      const updatedMembers = f.members.map((m) =>
        isCurrentFamilyMember(m, userId, profile.displayName, isCloudSync)
          ? { ...m, pagesToday: m.pagesToday + pages, totalPages: m.totalPages + pages, points: m.points + pages * 2 }
          : m
      );
      const next = { ...f, members: updatedMembers };
      if (isCloudSync) {
        for (const mm of updatedMembers) {
          if (isCurrentFamilyMember(mm, userId, profile.displayName, isCloudSync)) {
            void upsertMember(mm, f.id);
          }
        }
      }
      return next;
    });
  }, [profile.displayName, userId, isCloudSync]);

  const addSoloReward = useCallback((r: Omit<Reward, 'id' | 'redeemedToday' | 'lastRedeemedDate'>) => {
    setSoloRewards((arr) => [
      ...arr,
      { ...r, id: generateUUID(), redeemedToday: false, lastRedeemedDate: null },
    ]);
  }, []);

  const removeSoloReward = useCallback((id: string) => {
    setSoloRewards((arr) => arr.filter((r) => r.id !== id));
  }, []);

  const redeemSoloReward = useCallback((id: string) => {
    setSoloRewards((arr) => {
      const reward = arr.find((r) => r.id === id);
      const updated = arr.map((r) =>
        r.id === id && !r.redeemedToday
          ? { ...r, redeemedToday: true, lastRedeemedDate: todayKey() }
          : r
      );
      if (reward && !reward.redeemedToday) {
        setStats((s) => ({ ...s, personalCharity: s.personalCharity + reward.amount }));
      }
      return updated;
    });
  }, []);

  const addKhatma = useCallback((name: string, dailyTarget: number) => {
    const k: QuranKhatma = {
      id: generateUUID(),
      name,
      startPage: 1,
      currentPage: 1,
      totalPages: 604,
      dailyTarget,
      createdAt: new Date().toISOString(),
      active: true,
    };
    setKhatmas((arr) => [...arr.map((x) => ({ ...x, active: false })), k]);
  }, []);

  const updateKhatmaPage = useCallback((id: string, page: number) => {
    setKhatmas((arr) =>
      arr.map((k) =>
        k.id === id ? { ...k, currentPage: Math.max(1, Math.min(604, page)), active: page < 604 } : k
      )
    );
  }, []);

  const removeKhatma = useCallback((id: string) => {
    setKhatmas((arr) => arr.filter((k) => k.id !== id));
  }, []);

  const makeMember = (name: string, isHead: boolean): FamilyMember => ({
    id: generateUUID(),
    name,
    points: 0,
    isHead,
    prayersToday: 0,
    totalPrayers: 0,
    pagesToday: 0,
    totalPages: 0,
  });

  const createFamily = useCallback(
    async (name: string) => {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      const headMember: FamilyMember = {
        ...makeMember(profile.displayName, true),
        id: userId,
        userId,
      };
      const fg: FamilyGroup = {
        id: generateUUID(),
        name,
        code,
        currency: 'ج.م',
        members: [headMember],
        treasury: 0,
        rewards: [],
      };

      if (isCloudSync) {
        console.log('[createFamily] attempting cloud insert for family:', fg.id, 'code:', fg.code);
        const ok = await insertFamily(fg);
        if (!ok) {
          console.error('[createFamily] FAILED cloud insert — showing alert to user.');
          alert('⚠️ عذراً، لم يتم إنشاء العائلة في السحابة.\n\nالأسباب المحتملة:\n1) لم يتم تشغيل ملف Migration في Supabase SQL Editor بعد.\n2) قم بفتح Console (F12) واستعراض رسائل الخطأ التفصيلية.\n\nسيتم إنشاء العائلة محلياً فقط.');
          // Still set local state for offline functionality
        } else {
          console.log('[createFamily] SUCCESS cloud insert.');
          try {
            await syncFamilyMembers(fg);
            // Re-fetch to VERIFY data actually persisted
            const verified = await fetchFamilyByUserId(userId);
            if (verified && verified.id) {
              console.log('[createFamily] VERIFIED family exists in DB:', verified.id);
              setFamily(verified);
              return;
            } else {
              console.warn('[createFamily] WARNING: insertFamily returned true but fetchFamilyByUserId found nothing.');
            }
          } catch (e) {
            console.error('[createFamily] post-insert sync error:', e);
          }
        }
      }

      // Fallback / local-only path
      setFamily(fg);
      if (isCloudSync) void syncFamilyMembers(fg);
    },
    [profile.displayName, userId, isCloudSync, syncFamilyMembers]
  );

  const joinFamily = useCallback(
    async (code: string) => {
      const currentMember: FamilyMember = {
        ...makeMember(profile.displayName, false),
        id: userId,
        userId,
        prayersToday: 0,
        pagesToday: stats.pagesReadToday,
        totalPrayers: stats.totalPrayersOnTime + stats.totalPrayersLate,
        totalPages: stats.totalPagesRead,
      };
      if (isCloudSync) {
        console.log('[joinFamily] attempting cloud lookup for code:', code);
        try {
          const remote = await fetchFamilyByCode(code);
          if (remote && remote.id) {
            console.log('[joinFamily] found remote family:', remote.id, remote.name);
            const safeRemoteMembers = Array.isArray(remote.members) ? remote.members : [];
            const safeRemoteRewards = Array.isArray(remote.rewards) ? remote.rewards : [];
            const alreadyExists = safeRemoteMembers.some((m) =>
              (!!m.userId && !!userId && m.userId === userId) || m.id === userId
            ) || safeRemoteMembers.some((m) => !m.userId && m.name === profile.displayName);
            const nextMembers = alreadyExists
              ? safeRemoteMembers.map((m) => {
                  const isMe = (!!m.userId && !!userId && m.userId === userId)
                    || m.id === userId
                    || (!m.userId && m.name === profile.displayName);
                  if (!isMe) return m;
                  return {
                    ...m,
                    pagesToday: currentMember.pagesToday,
                    totalPrayers: currentMember.totalPrayers,
                    totalPages: currentMember.totalPages,
                    userId: userId,
                  };
                })
              : [...safeRemoteMembers, currentMember];
            const finalFamily: FamilyGroup = {
              ...remote,
              members: nextMembers,
              rewards: safeRemoteRewards,
            };

            let upsertOk = true;
            try {
              if (!alreadyExists) {
                upsertOk = await upsertMember(currentMember, remote.id);
                if (!upsertOk) console.warn('[joinFamily] upsertMember returned false for new member.');
              } else {
                const matching = nextMembers.find((m) =>
                  (!!m.userId && !!userId && m.userId === userId) || m.id === userId
                ) || nextMembers.find((m) => !m.userId && m.name === profile.displayName);
                if (matching) {
                  upsertOk = await upsertMember(matching, remote.id);
                  if (!upsertOk) console.warn('[joinFamily] upsertMember returned false for existing member.');
                }
              }
            } catch (e) {
              upsertOk = false;
              console.error('[joinFamily] member upsert exception:', e);
            }

            setFamily(finalFamily);

            // Background refresh
            void (async () => {
              try {
                const refreshedMembers = await fetchFamilyMembers(remote.id);
                if (Array.isArray(refreshedMembers) && refreshedMembers.length > 0) {
                  setFamily((cur) => (cur ? { ...cur, members: refreshedMembers } : cur));
                }
                const refreshedRewards = await fetchFamilyRewards(remote.id);
                if (Array.isArray(refreshedRewards)) {
                  setFamily((cur) => (cur ? { ...cur, rewards: refreshedRewards } : cur));
                }
              } catch (e) {
                console.warn('[joinFamily] post-join refresh failed:', e);
              }
            })();

            if (!upsertOk) {
              alert('⚠️ تم الانضمام للعائلة محلياً لكن لم يتم حفظ العضو في السحابة.\nتفقد Console (F12) للتفاصيل، وتأكد من تشغيل Migration في Supabase SQL Editor.');
            }
            return;
          } else {
            throw new Error('الرمز غير صحيح أو العائلة غير موجودة في السحابة.');
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'تعذر الوصول إلى السحابة.';
          console.error('[joinFamily] cloud error:', msg, e);
          if (msg.includes('الرمز غير صحيح')) throw e;
          alert(`⚠️ تعذر الوصول إلى السحابة للانضمام:\n${msg}\n\nسيتم الانضمام محلياً فقط.`);
        }
      }
      const localFg: FamilyGroup = {
        id: `local-${code.toUpperCase()}-${generateUUID().slice(0, 6)}`,
        name: `عائلة ${code.toUpperCase()}`,
        code: code.toUpperCase(),
        currency: 'ج.م',
        members: [currentMember],
        treasury: 0,
        rewards: [],
      };
      setFamily(localFg);
      if (isCloudSync) {
        try {
          const ok = await insertFamily(localFg);
          if (ok) await syncFamilyMembers(localFg);
        } catch (e) {
          console.error('[joinFamily] local->cloud insert error:', e);
        }
      }
    },
    [profile.displayName, userId, isCloudSync, stats.pagesReadToday, stats.totalPrayersOnTime, stats.totalPrayersLate, stats.totalPagesRead, syncFamilyMembers]
  );

  const leaveFamily = useCallback(() => setFamily(null), []);

  const addFamilyDonation = useCallback(
    (amount: number) => {
      setFamily((f) => {
        if (!f) return f;
        const next = { ...f, treasury: f.treasury + amount };
        if (isCloudSync) {
          void updateFamilyTreasury(f.id, next.treasury);
        }
        return next;
      });
    },
    [isCloudSync]
  );

  const addFamilyReward = useCallback(
    (r: Omit<Reward, 'id' | 'redeemedToday' | 'lastRedeemedDate'>) => {
      setFamily((f) => {
        if (!f) return f;
        const reward: Reward = { ...r, id: generateUUID(), redeemedToday: false, lastRedeemedDate: null };
        const next = { ...f, rewards: [...f.rewards, reward] };
        if (isCloudSync) {
          void insertReward(reward, f.id);
        }
        return next;
      });
    },
    [isCloudSync]
  );

  const removeFamilyReward = useCallback(
    (id: string) => {
      setFamily((f) => {
        if (!f) return f;
        const next = { ...f, rewards: f.rewards.filter((r) => r.id !== id) };
        if (isCloudSync) {
          void deleteReward(id);
        }
        return next;
      });
    },
    [isCloudSync]
  );

  const redeemFamilyReward = useCallback(
    (memberId: string, rewardId: string) => {
      setFamily((f) => {
        if (!f) return f;
        const reward = f.rewards.find((r) => r.id === rewardId);
        if (!reward || reward.redeemedToday) return f;
        const newTreasury = f.treasury + reward.amount;
        const members = f.members.map((m) =>
          m.id === memberId ? { ...m, points: m.points + reward.amount } : m
        );
        const rewards = f.rewards.map((r) =>
          r.id === rewardId ? { ...r, redeemedToday: true, lastRedeemedDate: todayKey() } : r
        );
        const next = { ...f, members, rewards, treasury: newTreasury };
        if (isCloudSync) {
          void updateFamilyTreasury(f.id, newTreasury);
          void updateReward(rewardId, { redeemedToday: true, lastRedeemedDate: todayKey() }, f.id);
          const target = members.find((m) => m.id === memberId);
          if (target) void upsertMember(target, f.id);
        }
        return next;
      });
    },
    [isCloudSync]
  );

  const updateMemberStat = useCallback(
    (memberId: string, patch: Partial<FamilyMember>) => {
      setFamily((f) => {
        if (!f) return f;
        const members = f.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m));
        const next = { ...f, members };
        if (isCloudSync) {
          const target = members.find((m) => m.id === memberId);
          if (target) void upsertMember(target, f.id);
        }
        return next;
      });
    },
    [isCloudSync]
  );

  const refreshFamily = useCallback(async () => {
    if (!isCloudSync || !family?.id) return;
    try {
      const [newMembers, newRewards] = await Promise.all([
        fetchFamilyMembers(family.id).catch(() => []),
        fetchFamilyRewards(family.id).catch(() => []),
      ]);
      setFamily((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          members: Array.isArray(newMembers) && newMembers.length > 0 ? newMembers : cur.members,
          rewards: Array.isArray(newRewards) ? newRewards : cur.rewards,
        };
      });
    } catch (e) {
      console.error('refreshFamily error:', e);
    }
  }, [isCloudSync, family?.id]);

  const isCurrentMember = useCallback(
    (m: Partial<FamilyMember>) => isCurrentFamilyMember(m as FamilyMember, userId, profile.displayName, isCloudSync),
    [userId, profile.displayName, isCloudSync]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      updateSettings,
      toggleTheme,
      profile,
      updateProfile,
      signInEmail,
      signUpEmail,
      signInGuest,
      signInGoogle,
      signOut,
      userId,
      authenticated,
      authLoading,
      tracking,
      setPrayerStatus,
      tasbeeh,
      incrementTasbeeh,
      resetTasbeeh,
      stats,
      addCharity,
      addQuranPages,
      soloRewards,
      addSoloReward,
      removeSoloReward,
      redeemSoloReward,
      khatmas,
      addKhatma,
      updateKhatmaPage,
      removeKhatma,
      family,
      createFamily,
      joinFamily,
      leaveFamily,
      addFamilyDonation,
      addFamilyReward,
      removeFamilyReward,
      redeemFamilyReward,
      updateMemberStat,
      refreshFamily,
      isCurrentMember,
      prayers,
      setPrayers,
      location,
      setLocation: setLocationState,
      detecting,
      reDetectLocation,
      isCloudSync,
    }),
    [
      settings, updateSettings, toggleTheme, profile, updateProfile, signInEmail, signUpEmail, signInGuest,
      signInGoogle, signOut, userId, authenticated, authLoading, tracking, setPrayerStatus,
      tasbeeh, incrementTasbeeh, resetTasbeeh, stats, addCharity, addQuranPages, soloRewards, addSoloReward, removeSoloReward, redeemSoloReward, khatmas, addKhatma,
      updateKhatmaPage, removeKhatma, family, createFamily, joinFamily, leaveFamily,
      addFamilyDonation, addFamilyReward, removeFamilyReward, redeemFamilyReward, updateMemberStat,
      refreshFamily, isCurrentMember,
      prayers, location, reDetectLocation, detecting, isCloudSync,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function emptyTracking(): PrayerTracking {
  const base = { date: todayKey() } as PrayerTracking;
  for (const k of PRAYER_KEYS) base[k] = 'missed';
  return base;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
