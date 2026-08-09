import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FamilyGroup, FamilyMember, Reward, SoloStats, UserProfile } from '@/types';
import { generateUUID } from '@/utils/uuid';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
let available = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    available = true;
  } catch {
    client = null;
    available = false;
  }
}

export const supabase = client;
export const isSupabaseAvailable = () => available;

export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!available) return fallback;
  try {
    const result = await fn();
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

function cleanOAuthHash(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.hash) return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', pathname + search);
}

export async function handleOAuthRedirect(): Promise<boolean> {
  if (!available || !supabase || typeof window === 'undefined') return false;
  if (!window.location.hash.includes('access_token') && !window.location.hash.includes('refresh_token')) {
    return false;
  }
  try {
    const { data } = await supabase.auth.getSession();
    cleanOAuthHash();
    return !!data?.session;
  } catch {
    cleanOAuthHash();
    return false;
  }
}

export interface DBProfile {
  id: string;
  display_name: string;
  email: string;
  avatar_color?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface DBFamily {
  id: string;
  name: string;
  code: string;
  currency: string;
  treasury_balance: number;
  created_at?: string;
}

export interface DBFamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
  is_head: boolean;
  points: number;
  prayers_today: number;
  total_prayers: number;
  pages_today: number;
  total_pages: number;
}

export interface DBDailyProgress {
  id: string;
  user_id: string;
  date: string;
  pages_read: number;
}

export interface DBReward {
  id: string;
  family_id: string;
  title: string;
  description: string;
  reward_type: string;
  target: number;
  amount: number;
  currency: string;
  redeemed_today: boolean;
  last_redeemed_at: string | null;
}

function dbToReward(r: DBReward): Reward {
  return {
    id: r.id || generateUUID(),
    title: typeof r.title === 'string' ? r.title : 'جائزة',
    description: typeof r.description === 'string' ? r.description : '',
    type: (typeof r.reward_type === 'string' ? r.reward_type : 'custom') as Reward['type'],
    target: typeof r.target === 'number' ? r.target : 1,
    amount: typeof r.amount === 'number' ? r.amount : 0,
    currency: typeof r.currency === 'string' ? r.currency : 'ج.م',
    redeemedToday: !!r.redeemed_today,
    lastRedeemedDate: r.last_redeemed_at ? r.last_redeemed_at.slice(0, 10) : null,
  };
}

function rewardToDb(r: Reward, familyId: string): Omit<DBReward, 'id'> {
  return {
    family_id: familyId,
    title: r.title,
    description: r.description,
    reward_type: r.type,
    target: r.target,
    amount: r.amount,
    currency: r.currency,
    redeemed_today: !!r.redeemedToday,
    last_redeemed_at: r.lastRedeemedDate ? new Date(r.lastRedeemedDate).toISOString() : null,
  };
}

function dbToMember(m: DBFamilyMember): FamilyMember {
  return {
    id: m.id || generateUUID(),
    name: typeof m.display_name === 'string' ? m.display_name : 'عضو',
    points: typeof m.points === 'number' ? m.points : 0,
    isHead: !!m.is_head,
    prayersToday: typeof m.prayers_today === 'number' ? m.prayers_today : 0,
    totalPrayers: typeof m.total_prayers === 'number' ? m.total_prayers : 0,
    pagesToday: typeof m.pages_today === 'number' ? m.pages_today : 0,
    totalPages: typeof m.total_pages === 'number' ? m.total_pages : 0,
  };
}

export interface AuthResult {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
  success: boolean;
  method: 'email' | 'guest' | 'google';
  error?: string;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  const baseResult: AuthResult = {
    id: emailIdFromEmail(email),
    email: email || `${displayName}@guest.tawbah.local`,
    displayName: displayName || 'ضيف توبة',
    avatarColor: '#d97706',
    success: false,
    method: 'email',
  };
  if (!available || !supabase) {
    await upsertLocalProfile(baseResult);
    return { ...baseResult, success: true };
  }
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: undefined,
      },
    });
    if (error && !error.message.includes('Email not confirmed') && !error.message.includes('confirmation')) {
      await upsertLocalProfile(baseResult);
      return { ...baseResult, success: true, error: error.message };
    }
    const uid = data.user?.id || baseResult.id;
    const profileRow: DBProfile = {
      id: uid,
      display_name: displayName,
      email: email,
    };
    try {
      await supabase.from('profiles').upsert(profileRow);
    } catch {
      // ignore profile upsert failures
    }
    return { ...baseResult, id: uid, success: true };
  } catch (e) {
    void e;
    await upsertLocalProfile(baseResult);
    return { ...baseResult, success: true };
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
  fallbackName?: string
): Promise<AuthResult> {
  const baseResult: AuthResult = {
    id: emailIdFromEmail(email),
    email: email,
    displayName: fallbackName || email.split('@')[0] || 'ضيف توبة',
    avatarColor: '#d97706',
    success: false,
    method: 'email',
  };
  if (!available || !supabase) {
    await upsertLocalProfile(baseResult);
    return { ...baseResult, success: true };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('credentials') ||
        error.message.includes('not confirmed') ||
        error.message.includes('confirmation') ||
        error.message.includes('exist') ||
        error.message.includes('disabled')
      ) {
        await upsertLocalProfile(baseResult);
        return { ...baseResult, success: true, error: error.message };
      }
      await upsertLocalProfile(baseResult);
      return { ...baseResult, success: true, error: error.message };
    }
    const uid = data.user?.id || baseResult.id;
    const existing = await fetchProfile(uid);
    const profileRow: DBProfile = {
      id: uid,
      display_name: existing?.displayName || baseResult.displayName,
      email: email,
    };
    try {
      await supabase.from('profiles').upsert(profileRow);
    } catch {
      // ignore
    }
    return {
      ...baseResult,
      id: uid,
      displayName: profileRow.display_name,
      avatarColor: existing?.avatarColor || baseResult.avatarColor,
      success: true,
    };
  } catch (e) {
    void e;
    await upsertLocalProfile(baseResult);
    return { ...baseResult, success: true };
  }
}

export async function signInAsGuest(displayName: string, seedColor = '#d97706'): Promise<AuthResult> {
  const id = localStorage.getItem('tawbah:guestid') || `guest-${generateUUID()}`;
  localStorage.setItem('tawbah:guestid', id);
  const res: AuthResult = {
    id,
    email: '',
    displayName: displayName || 'ضيف توبة',
    avatarColor: seedColor,
    success: true,
    method: 'guest',
  };
  await upsertLocalProfile(res);
  // Guest accounts are local-only; do not sync invalid guest IDs to Supabase.
  return res;
}

export async function signOutCurrent(): Promise<void> {
  if (available && supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
}

export async function getCurrentSessionUserId(): Promise<string | null> {
  if (!available || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id || null;
  } catch {
    return null;
  }
}

function emailIdFromEmail(email: string): string {
  try {
    let h = 2166136261;
    const str = (email || 'guest').toLowerCase();
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `u_${(h >>> 0).toString(36)}`;
  } catch {
    return `u_${generateUUID()}`;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function upsertLocalProfile(profile: AuthResult): Promise<void> {
  try {
    const row: DBProfile = {
      id: profile.id,
      display_name: profile.displayName,
      email: profile.email,
      avatar_color: profile.avatarColor,
    };
    const key = `tawbah:localprofile:${profile.id}`;
    localStorage.setItem(key, JSON.stringify(row));
    localStorage.setItem('tawbah:currentuserid', profile.id);
  } catch {
    // ignore
  }
}

export function readLocalProfile(): { id: string; display_name: string; email: string; avatar_color: string } | null {
  try {
    const uid = localStorage.getItem('tawbah:currentuserid');
    if (!uid) return null;
    const raw = localStorage.getItem(`tawbah:localprofile:${uid}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  return safeQuery(async () => {
    try {
      const { data, error } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error || !data || typeof data !== 'object') return null;
      const p = data as DBProfile;
      return {
        displayName: typeof p.display_name === 'string' ? p.display_name : 'مستخدم توبة',
        email: typeof p.email === 'string' ? p.email : '',
        avatarColor: typeof p.avatar_color === 'string' ? p.avatar_color : '#d97706',
        avatarUrl: typeof p.avatar_url === 'string' ? p.avatar_url : undefined,
        loggedIn: true,
      };
    } catch {
      return null;
    }
  }, null);
}

export async function upsertProfile(profile: UserProfile & { id?: string }): Promise<boolean> {
  return safeQuery(async () => {
    const id = profile.id || generateUUID();
    const row: DBProfile = {
      id,
      display_name: profile.displayName,
      email: profile.email || '',
    };
    const { error } = await supabase!
      .from('profiles')
      .upsert(row, { onConflict: 'id' });
    return !error;
  }, false);
}

export async function fetchFamilyByUserId(userId: string): Promise<FamilyGroup | null> {
  return safeQuery(async () => {
    if (!supabase || !userId) return null;
    const { data: membership, error: membershipError } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError || !membership || typeof membership !== 'object' || !('family_id' in membership)) {
      return null;
    }

    const familyId = (membership as { family_id: string }).family_id;
    if (!familyId) return null;

    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .maybeSingle();
    if (error || !data) return null;

    const fam = data as DBFamily;
    const members = await fetchFamilyMembers(fam.id);
    const rewards = await fetchFamilyRewards(fam.id);

    return {
      id: fam.id,
      name: typeof fam.name === 'string' ? fam.name || `عائلة ${fam.code}` : `عائلة ${fam.code}`,
      code: typeof fam.code === 'string' ? fam.code : 'LOCAL',
      currency: typeof fam.currency === 'string' ? fam.currency || 'ج.م' : 'ج.م',
      members,
      treasury: typeof fam.treasury_balance === 'number' ? fam.treasury_balance : 0,
      rewards,
    };
  }, null);
}

export async function fetchFamilyByCode(
  code: string,
  fallbackMembers?: FamilyMember[]
): Promise<FamilyGroup> {
  const localFallback: FamilyGroup = {
    id: `local-${code.toUpperCase()}`,
    name: `عائلة ${code.toUpperCase()}`,
    code: code.toUpperCase(),
    currency: 'ج.م',
    members: Array.isArray(fallbackMembers) && fallbackMembers.length ? fallbackMembers : [],
    treasury: 0,
    rewards: [],
  };
  return safeQuery(async () => {
    if (!supabase) return localFallback;
    try {
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle();
      if (error || !data) return localFallback;
      const fam = data as DBFamily;
      let members: FamilyMember[] = [];
      let rewards: Reward[] = [];
      try {
        const rawMembers = await fetchFamilyMembers(fam.id);
        members = Array.isArray(rawMembers) ? rawMembers : [];
      } catch {
        members = Array.isArray(fallbackMembers) ? fallbackMembers : [];
      }
      try {
        const rawRewards = await fetchFamilyRewards(fam.id);
        rewards = Array.isArray(rawRewards) ? rawRewards : [];
      } catch {
        rewards = [];
      }
      return {
        id: fam.id,
        name: typeof fam.name === 'string' ? fam.name || localFallback.name : localFallback.name,
        code: typeof fam.code === 'string' ? fam.code || localFallback.code : localFallback.code,
        currency: typeof fam.currency === 'string' ? fam.currency || 'ج.م' : 'ج.م',
        members,
        treasury: typeof fam.treasury_balance === 'number' ? fam.treasury_balance : 0,
        rewards,
      };
    } catch {
      return localFallback;
    }
  }, localFallback);
}

export async function fetchFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  return safeQuery(async () => {
    try {
      const { data, error } = await supabase!
        .from('family_members')
        .select('*')
        .eq('family_id', familyId);
      if (error || !Array.isArray(data)) return [];
      const result: FamilyMember[] = [];
      for (const raw of data) {
        try {
          result.push(dbToMember(raw as DBFamilyMember));
        } catch {
          // skip malformed rows
        }
      }
      return result;
    } catch {
      return [];
    }
  }, []);
}

export async function fetchFamilyRewards(familyId: string): Promise<Reward[]> {
  return safeQuery(async () => {
    try {
      const { data, error } = await supabase!
        .from('rewards')
        .select('*')
        .eq('family_id', familyId);
      if (error || !Array.isArray(data)) return [];
      const result: Reward[] = [];
      for (const raw of data) {
        try {
          result.push(dbToReward(raw as DBReward));
        } catch {
          // skip malformed rows
        }
      }
      return result;
    } catch {
      return [];
    }
  }, []);
}

export async function insertFamily(fg: FamilyGroup): Promise<boolean> {
  return safeQuery(async () => {
    if (!supabase) return true;
    const famRow: DBFamily = {
      id: fg.id || `fam-${Date.now().toString(36)}`,
      name: fg.name || 'عائلة توبة',
      code: (fg.code || 'LOCAL').toUpperCase(),
      currency: fg.currency || 'ج.م',
      treasury_balance: typeof fg.treasury === 'number' ? fg.treasury : 0,
    };
    try {
      const { error: e1 } = await supabase.from('families').upsert(famRow, { onConflict: 'id' });
      if (e1) return true;
    } catch {
      return true;
    }
    if (Array.isArray(fg.members) && fg.members.length) {
      const rows = fg.members.map<DBFamilyMember>((m) => {
        const userId = m.userId || m.id || generateUUID();
        return {
          id: m.id || generateUUID(),
          family_id: famRow.id,
          user_id: userId,
          display_name: m.name || 'عضو',
          is_head: !!m.isHead,
          points: typeof m.points === 'number' ? m.points : 0,
          prayers_today: typeof m.prayersToday === 'number' ? m.prayersToday : 0,
          total_prayers: typeof m.totalPrayers === 'number' ? m.totalPrayers : 0,
          pages_today: typeof m.pagesToday === 'number' ? m.pagesToday : 0,
          total_pages: typeof m.totalPages === 'number' ? m.totalPages : 0,
        };
      });
      try {
        const { error: e2 } = await supabase.from('family_members').upsert(rows, { onConflict: 'id' });
        if (e2) return true;
      } catch {
        return true;
      }
    }
    return true;
  }, true);
}

export async function updateFamilyTreasury(familyId: string, balance: number): Promise<boolean> {
  return safeQuery(async () => {
    const { error } = await supabase!
      .from('families')
      .update({ treasury_balance: balance })
      .eq('id', familyId);
    return !error;
  }, false);
}

export async function upsertMember(member: FamilyMember, familyId: string): Promise<boolean> {
  return safeQuery(async () => {
    const userId = member.userId || member.id;
    if (!userId) return false;

    let rowId = member.id || generateUUID();
    try {
      const { data: existing, error: existingError } = await supabase!
        .from('family_members')
        .select('id')
        .eq('family_id', familyId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!existingError && existing && typeof existing === 'object' && typeof existing.id === 'string') {
        rowId = existing.id;
      }
    } catch {
      // ignore membership lookup errors, fall back to provided row id
    }

    const row: DBFamilyMember = {
      id: rowId,
      family_id: familyId,
      user_id: userId,
      display_name: member.name,
      is_head: member.isHead,
      points: member.points,
      prayers_today: member.prayersToday,
      total_prayers: member.totalPrayers,
      pages_today: member.pagesToday,
      total_pages: member.totalPages,
    };
    const { error } = await supabase!.from('family_members').upsert(row, { onConflict: 'id' });
    return !error;
  }, false);
}

export async function insertReward(reward: Reward, familyId: string): Promise<boolean> {
  return safeQuery(async () => {
    const row = rewardToDb(reward, familyId);
    const { error } = await supabase!.from('rewards').upsert({ ...row, id: reward.id }, { onConflict: 'id' });
    return !error;
  }, false);
}

export async function updateReward(rewardId: string, patch: Partial<Reward>, familyId: string): Promise<boolean> {
  return safeQuery(async () => {
    const row: Partial<DBReward> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.type !== undefined) row.reward_type = patch.type;
    if (patch.target !== undefined) row.target = patch.target;
    if (patch.amount !== undefined) row.amount = patch.amount;
    if (patch.currency !== undefined) row.currency = patch.currency;
    if (patch.redeemedToday !== undefined) row.redeemed_today = patch.redeemedToday;
    if (patch.lastRedeemedDate !== undefined) {
      row.last_redeemed_at = patch.lastRedeemedDate ? new Date(patch.lastRedeemedDate).toISOString() : null;
    }
    row.family_id = familyId;
    const { error } = await supabase!.from('rewards').update(row).eq('id', rewardId);
    return !error;
  }, false);
}

export async function deleteReward(rewardId: string): Promise<boolean> {
  return safeQuery(async () => {
    const { error } = await supabase!.from('rewards').delete().eq('id', rewardId);
    return !error;
  }, false);
}

export async function upsertDailyProgress(progress: {
  userId: string;
  date: string;
  stats: SoloStats;
}): Promise<boolean> {
  return safeQuery(async () => {
    if (!progress.userId || !progress.date || !isUuid(progress.userId)) return false;

    const { data: existing, error: fetchError } = await supabase!
      .from('daily_progress')
      .select('id')
      .eq('user_id', progress.userId)
      .eq('date', progress.date)
      .maybeSingle();
    if (fetchError) return false;

    const row: DBDailyProgress = {
      id: existing?.id || generateUUID(),
      user_id: progress.userId,
      date: progress.date,
      pages_read: progress.stats.totalPagesRead,
    };
    const { error } = await supabase!
      .from('daily_progress')
      .upsert(row, { onConflict: 'id' });
    return !error;
  }, false);
}

export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  if (!available || !supabase) {
    return { success: false, error: 'Supabase غير متوفر' };
  }
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'خطأ غير معروف' };
  }
}

export interface AuthStateUser {
  id: string;
  displayName: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

export function subscribeAuthChanges(callback: (user: AuthStateUser | null) => void): () => void {
  if (!available || !supabase) {
    return () => {};
  }
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (typeof window !== 'undefined' && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'))) {
      cleanOAuthHash();
    }
    if (session?.user) {
      const u = session.user;
      const displayName = (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'مستخدم توبة';
      const avatarUrl = (u.user_metadata?.avatar_url as string) || null;
      const profile: DBProfile = {
        id: u.id,
        display_name: displayName,
        email: u.email || '',
      };
      try {
        await supabase!.from('profiles').upsert(profile, { onConflict: 'id' });
      } catch {
        // ignore profile upsert failures
      }
      await upsertLocalProfile({
        id: u.id,
        displayName,
        email: u.email || '',
        avatarColor: '#064e3b',
        success: true,
        method: 'google',
      });
      callback({
        id: u.id,
        displayName,
        email: u.email || '',
        avatarColor: '#064e3b',
        avatarUrl,
      });
    } else {
      callback(null);
    }
  });
  return () => {
    try { data.subscription.unsubscribe(); } catch { /* ignore */ }
  };
}

export async function fetchCurrentSession(): Promise<AuthStateUser | null> {
  if (!available || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user) return null;
    const u = session.user;
    const displayName = (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'مستخدم توبة';
    const avatarUrl = (u.user_metadata?.avatar_url as string) || null;
    return {
      id: u.id,
      displayName,
      email: u.email || '',
      avatarColor: '#064e3b',
      avatarUrl,
    };
  } catch {
    return null;
  }
}

export async function fetchDailyProgress(userId: string, date: string): Promise<SoloStats | null> {
  return safeQuery(async () => {
    try {
      const { data, error } = await supabase!
        .from('daily_progress')
        .select('pages_read')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      if (error || !data || typeof data !== 'object') return null;
      const p = data as { pages_read?: number };
      const pages = typeof p.pages_read === 'number' ? p.pages_read : 0;
      return {
        streak: 0,
        totalPrayersOnTime: 0,
        totalPrayersLate: 0,
        totalPrayersMissed: 0,
        personalCharity: 0,
        pagesReadToday: pages,
        totalPagesRead: pages,
        badges: [],
        lastCompletedDate: null,
      };
    } catch {
      return null;
    }
  }, null);
}
