import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FamilyGroup, FamilyMember, Reward, SoloStats, UserProfile } from '@/types';
import { generateUUID } from '@/utils/uuid';
import { localDateKey } from '@/services/storage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
let available = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: {
        headers: {
          'X-Client-Info': 'tawbah-app/1.0',
        },
      },
    });
    available = true;
    // eslint-disable-next-line no-console
    console.log('[supabase] initialized with URL:', SUPABASE_URL);
  } catch (e) {
    console.error('[supabase] FAILED to initialize:', e);
    client = null;
    available = false;
  }
} else {
  console.warn('[supabase] NOT initialized — VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in .env');
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
  family_id?: string;
  role?: string;
  points?: number;
  prayers_today?: number;
  total_prayers?: number;
  pages_today?: number;
  total_pages?: number;
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
  pages_today?: number;
  prayers_completed?: number;
  prayers_on_time?: number;
  prayers_late?: number;
  prayers_missed?: number;
  personal_charity?: number;
  streak_days?: number;
  tasbeeh_count?: number;
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

function profileToFamilyMember(p: DBProfile): FamilyMember {
  return {
    id: p.id || generateUUID(),
    userId: p.id,
    name: typeof p.display_name === 'string' ? p.display_name : 'عضو',
    points: typeof p.points === 'number' ? p.points : 0,
    isHead: p.role === 'head',
    prayersToday: typeof p.prayers_today === 'number' ? p.prayers_today : 0,
    totalPrayers: typeof p.total_prayers === 'number' ? p.total_prayers : 0,
    pagesToday: typeof p.pages_today === 'number' ? p.pages_today : 0,
    totalPages: typeof p.total_pages === 'number' ? p.total_pages : 0,
  };
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
    userId: typeof m.user_id === 'string' ? m.user_id : undefined,
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
    const { data: memberRow, error: memberError } = await supabase!
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (memberError || !memberRow || typeof memberRow !== 'object' || !('family_id' in memberRow)) {
      return null;
    }

    const familyId = (memberRow as { family_id?: string }).family_id;
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

export async function fetchFamilyByCode(code: string): Promise<FamilyGroup | null> {
  if (!available || !supabase) return null;
  try {
    const normalized = code.toUpperCase().trim();
    const { data: peek, error: peekErr } = await supabase
      .rpc('peek_family_by_code', { input_code: normalized });
    if (peekErr || !peek || !Array.isArray(peek) || peek.length === 0) return null;
    const row = peek[0] as { id?: unknown; name?: unknown; currency?: unknown };
    const famId = typeof row?.id === 'string' ? row.id : undefined;
    if (!famId || !isUuid(famId)) return null;
    const members = await fetchFamilyMembers(famId);
    const rewards = await fetchFamilyRewards(famId);
    return {
      id: famId,
      name: (typeof row?.name === 'string' && row.name) || `عائلة ${normalized}`,
      code: normalized,
      currency: (typeof row?.currency === 'string' && row.currency) || 'ج.م',
      members,
      treasury: 0,
      rewards,
    };
  } catch (e) {
    console.error('fetchFamilyByCode error:', e);
    return null;
  }
}

export async function fetchFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  return safeQuery(async () => {
    if (!available || !supabase || !familyId || !isUuid(familyId)) return [];
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('*, profiles(*)')
        .eq('family_id', familyId);
      if (error || !Array.isArray(data)) return [];
      const memberRows = data as (DBFamilyMember & { profiles?: DBProfile | null })[];
      const today = localDateKey(new Date());
      const progressByUser = new Map<string, DBDailyProgress>();
      try {
        const userIds = memberRows.map(m => m.user_id).filter((v): v is string => typeof v === 'string' && isUuid(v));
        if (userIds.length > 0) {
          const { data: dp, error: dpErr } = await supabase
            .from('daily_progress')
            .select('*')
            .in('user_id', userIds)
            .eq('date', today);
          if (!dpErr && Array.isArray(dp)) {
            for (const row of dp) {
              const r = row as DBDailyProgress;
              if (r && typeof r.user_id === 'string') {
                progressByUser.set(r.user_id, r);
              }
            }
          }
        }
      } catch (e) {
        console.error('fetchFamilyMembers.dailyProgress error:', e);
      }
      const result: FamilyMember[] = [];
      for (const m of memberRows) {
        try {
          const profile = m.profiles;
          const dp = typeof m.user_id === 'string' ? progressByUser.get(m.user_id) : undefined;
          const pToday = typeof dp?.pages_today === 'number' ? dp.pages_today
            : (typeof dp?.pages_read === 'number' ? dp.pages_read : undefined);
          const prayersOnTime = typeof dp?.prayers_on_time === 'number' ? dp.prayers_on_time
            : (typeof dp?.prayers_completed === 'number' ? dp.prayers_completed : 0);
          const prayersLate = typeof dp?.prayers_late === 'number' ? dp.prayers_late : 0;
          result.push({
            id: m.id || generateUUID(),
            userId: typeof m.user_id === 'string' ? m.user_id : undefined,
            name: (profile && typeof profile.display_name === 'string' && profile.display_name) || (typeof m.display_name === 'string' && m.display_name) || 'عضو',
            points: typeof m.points === 'number' ? m.points : 0,
            isHead: !!m.is_head,
            prayersToday: pToday !== undefined ? (prayersOnTime + prayersLate) : (typeof m.prayers_today === 'number' ? m.prayers_today : 0),
            totalPrayers: typeof m.total_prayers === 'number' ? m.total_prayers : 0,
            pagesToday: pToday !== undefined ? pToday : (typeof m.pages_today === 'number' ? m.pages_today : 0),
            totalPages: typeof m.total_pages === 'number' ? m.total_pages : 0,
          });
        } catch {
          // skip malformed rows
        }
      }
      return result;
    } catch (e) {
      console.error('fetchFamilyMembers error:', e);
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
  if (!available || !supabase) return false;
  try {
    const famRow: Partial<DBFamily> & { id: string; created_by?: string } = {
      id: fg.id || `fam-${Date.now().toString(36)}`,
      name: fg.name || 'عائلة توبة',
      code: (fg.code || 'LOCAL').toUpperCase(),
      currency: fg.currency || 'ج.م',
      treasury_balance: typeof fg.treasury === 'number' ? fg.treasury : 0,
    };
    try {
      const sessionUser = await fetchCurrentSession();
      if (sessionUser) famRow.created_by = sessionUser.id;
    } catch (e) {
      console.warn('insertFamily: no session user for created_by:', e);
    }
    const { error: e1 } = await supabase.from('families').upsert(famRow, { onConflict: 'id' });
    if (e1) {
      console.error('insertFamily families.upsert error:', e1.message, 'code:', e1.code, 'details:', e1.details);
      return false;
    }
    if (Array.isArray(fg.members) && fg.members.length) {
      for (const m of fg.members) {
        const mUserId = m.userId || m.id;
        if (!mUserId || !isUuid(mUserId)) {
          console.warn('insertFamily: skip member (invalid uuid):', mUserId, m.name);
          continue;
        }
        {
          const { error: pe } = await supabase.from('profiles').upsert({
            id: mUserId,
            display_name: m.name || 'عضو',
          }, { onConflict: 'id' });
          if (pe) console.warn('insertFamily profile upsert warn:', pe.message);
        }
        {
          const { error: me } = await supabase.from('family_members').upsert({
            family_id: famRow.id,
            user_id: mUserId,
            display_name: m.name || 'عضو',
            is_head: !!m.isHead,
            points: typeof m.points === 'number' ? m.points : 0,
            prayers_today: typeof m.prayersToday === 'number' ? m.prayersToday : 0,
            total_prayers: typeof m.totalPrayers === 'number' ? m.totalPrayers : 0,
            pages_today: typeof m.pagesToday === 'number' ? m.pagesToday : 0,
            total_pages: typeof m.totalPages === 'number' ? m.totalPages : 0,
          }, { onConflict: 'user_id' });
          if (me) console.error('insertFamily family_members upsert error:', me.message, 'code:', me.code, 'details:', me.details);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('insertFamily exception:', err);
    return false;
  }
}

export async function removeFamilyMember(userId: string): Promise<boolean> {
  if (!available || !supabase) return false;
  try {
    const { error } = await supabase.from('family_members').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
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
  if (!available || !supabase || !familyId || !isUuid(familyId)) return false;
  try {
    const userId = member.userId || member.id;
    if (!userId) return false;

    {
      const { error: pe } = await supabase.from('profiles').upsert({
        id: userId,
        display_name: member.name,
      }, { onConflict: 'id' });
      if (pe) console.warn('upsertMember profile upsert warn:', pe.message);
    }

    const { error } = await supabase.from('family_members').upsert({
      id: member.id || undefined,
      family_id: familyId,
      user_id: userId,
      display_name: member.name,
      is_head: !!member.isHead,
      points: typeof member.points === 'number' ? member.points : 0,
      prayers_today: typeof member.prayersToday === 'number' ? member.prayersToday : 0,
      total_prayers: typeof member.totalPrayers === 'number' ? member.totalPrayers : 0,
      pages_today: typeof member.pagesToday === 'number' ? member.pagesToday : 0,
      total_pages: typeof member.totalPages === 'number' ? member.totalPages : 0,
    }, { onConflict: 'user_id' });
    if (error) {
      console.error('upsertMember family_members upsert error:', error.message, 'code:', error.code, 'details:', error.details);
      return false;
    }
    return true;
  } catch (err) {
    console.error('upsertMember exception:', err);
    return false;
  }
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
  tasbeehCount?: number;
}): Promise<boolean> {
  return safeQuery(async () => {
    if (!progress.userId || !progress.date || !isUuid(progress.userId)) return false;

    try {
      await supabase!
        .from('profiles')
        .upsert(
          {
            id: progress.userId,
            display_name: 'مستخدم توبة',
            email: '',
          },
          { onConflict: 'id', ignoreDuplicates: true, defaultToNull: false }
        );
    } catch (profileErr) {
      console.warn('ensureProfileExists skipped:', profileErr instanceof Error ? profileErr.message : String(profileErr));
    }

    const row: Omit<DBDailyProgress, 'id'> = {
      user_id: progress.userId,
      date: progress.date,
      pages_read: progress.stats.totalPagesRead,
      pages_today: progress.stats.pagesReadToday,
      prayers_completed: progress.stats.totalPrayersOnTime + progress.stats.totalPrayersLate,
      prayers_on_time: progress.stats.totalPrayersOnTime,
      prayers_late: progress.stats.totalPrayersLate,
      prayers_missed: progress.stats.totalPrayersMissed,
      personal_charity: progress.stats.personalCharity,
      streak_days: progress.stats.streak,
      tasbeeh_count: progress.tasbeehCount,
    };

    const { error } = await supabase!
      .from('daily_progress')
      .upsert(row, { onConflict: 'user_id, date', ignoreDuplicates: false, defaultToNull: false });
    if (error) {
      console.error('upsertDailyProgress error:', error.message, error.code, error.details);
    }
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
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    (async () => {
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
    })();
  });
  return () => {
    try { data.subscription.unsubscribe(); } catch { /* ignore */ }
  };
}

export async function fetchCurrentSession(): Promise<AuthStateUser | null> {
  if (!available || !supabase) return null;
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 5000)
    );
    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
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
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      if (error || !data || typeof data !== 'object') return null;
      const p = data as DBDailyProgress;
      const pagesCumulative = typeof p.pages_read === 'number' ? p.pages_read : 0;
      const pagesToday = typeof p.pages_today === 'number' ? p.pages_today : pagesCumulative;
      const totalCompleted = typeof p.prayers_completed === 'number' ? p.prayers_completed : 0;
      const onTime = typeof p.prayers_on_time === 'number' ? p.prayers_on_time : totalCompleted;
      const late = typeof p.prayers_late === 'number' ? p.prayers_late : 0;
      const missed = typeof p.prayers_missed === 'number' ? p.prayers_missed : 0;
      const charity = typeof p.personal_charity === 'number' ? p.personal_charity : 0;
      const streak = typeof p.streak_days === 'number' ? p.streak_days : 0;
      return {
        streak,
        totalPrayersOnTime: Math.max(onTime, totalCompleted - late),
        totalPrayersLate: late,
        totalPrayersMissed: missed,
        personalCharity: charity,
        pagesReadToday: pagesToday,
        totalPagesRead: pagesCumulative,
        badges: [],
        lastCompletedDate: null,
      };
    } catch (e) {
      console.error('fetchDailyProgress error:', e);
      return null;
    }
  }, null);
}

export async function fetchTasbeehForToday(userId: string, date: string): Promise<number | null> {
  if (!available || !supabase || !userId || !isUuid(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('daily_progress')
      .select('tasbeeh_count')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();
    if (error || !data) return null;
    const count = (data as { tasbeeh_count?: unknown }).tasbeeh_count;
    return typeof count === 'number' ? count : null;
  } catch (e) {
    console.error('fetchTasbeehForToday error:', e);
    return null;
  }
}
