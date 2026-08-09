// Placeholder service for future Supabase integration (family sync, cloud profiles)
// Currently returns local-only operations. Wire to Supabase by replacing the bodies.

import type { FamilyGroup, SoloStats, UserProfile } from '@/types';
import { generateUUID } from '@/utils/uuid';

export const familyService = {
  async createFamily(name: string, headName: string): Promise<FamilyGroup> {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    return {
      id: generateUUID(),
      name,
      code,
      members: [{ id: generateUUID(), name: headName, points: 0, isHead: true, prayersToday: 0, totalPrayers: 0, pagesToday: 0, totalPages: 0 }],
      treasury: 0,
      currency: 'ج.م',
      rewards: [],
    };
  },

  async joinFamily(code: string, memberName: string): Promise<FamilyGroup | null> {
    // TODO: supabase lookup by code
    return null;
  },

  async addDonation(familyId: string, amount: number): Promise<void> {
    // TODO: supabase.from('family_donations').insert(...)
    void familyId;
    void amount;
  },
};

export const profileService = {
  async signInWithEmail(email: string, _password: string): Promise<UserProfile | null> {
    // TODO: supabase.auth.signInWithPassword
    void email;
    return null;
  },
  async signInWithGoogle(): Promise<UserProfile | null> {
    // TODO: supabase.auth.signInWithOAuth({ provider: 'google' })
    return null;
  },
  async signOut(): Promise<void> {
    // TODO: supabase.auth.signOut()
  },
};

export const statsService = {
  async syncStats(_stats: SoloStats): Promise<void> {
    // TODO: upsert to user_stats table
  },
};
