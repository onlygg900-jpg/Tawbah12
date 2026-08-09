export type PrayerKey = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type PrayerStatus = 'on_time' | 'late' | 'missed';

export interface PrayerInfo {
  key: PrayerKey;
  label: string;
  time: string; // "HH:MM"
}

export interface PrayerTracking {
  date: string; // YYYY-MM-DD
  Fajr: PrayerStatus;
  Dhuhr: PrayerStatus;
  Asr: PrayerStatus;
  Maghrib: PrayerStatus;
  Isha: PrayerStatus;
}

export interface TasbeehCount {
  date: string;
  count: number;
}

export interface QuranKhatma {
  id: string;
  name: string;
  startPage: number;
  currentPage: number;
  totalPages: number;
  dailyTarget: number;
  createdAt: string;
  active: boolean;
}

export interface SoloStats {
  streak: number;
  totalPrayersOnTime: number;
  totalPrayersLate: number;
  totalPrayersMissed: number;
  personalCharity: number;
  pagesReadToday: number;
  totalPagesRead: number;
  badges: string[];
  lastCompletedDate: string | null;
}

export type RewardType = 'prayer_all' | 'prayer_on_time' | 'quran_pages' | 'streak' | 'custom';

export interface Reward {
  id: string;
  title: string;
  description: string;
  type: RewardType;
  target: number; // e.g. 5 prayers, 10 pages, 7-day streak
  amount: number; // money/points awarded
  currency: string;
  redeemedToday?: boolean;
  lastRedeemedDate?: string | null;
}

export interface FamilyMember {
  id: string;
  userId?: string;
  name: string;
  points: number;
  isHead: boolean;
  prayersToday: number;
  totalPrayers: number;
  pagesToday: number;
  totalPages: number;
}

export interface FamilyGroup {
  id: string;
  name: string;
  code: string;
  currency: string;
  members: FamilyMember[];
  treasury: number;
  rewards: Reward[];
}

export interface UserProfile {
  displayName: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string | null;
  loggedIn: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  morningAdhkar: boolean;
  eveningAdhkar: boolean;
  afterPrayerAdhkar: boolean;
  dailyHadith: boolean;
  prayerReminders: boolean;
}

export interface ContentBlockerSettings {
  enabled: boolean;
  provider: 'adguard' | 'cloudflare' | 'none';
  adminLocked: boolean;
  adminPin: string | null;
  nativeVpnEnabled: boolean;
 nativeVpnProvider: 'adguard' | 'cloudflare' | 'none';
}

export interface AppSettings {
  theme: 'light' | 'dark';
  city: string;
  country: string;
  calcMethod: number;
  notifications: NotificationSettings;
  contentBlocker: ContentBlockerSettings;
}

export interface Surah {
  id: number;
  name: string;
  englishName: string;
  arabicName: string;
  revelationPlace: string;
  versesCount: number;
  pages: string;
}

export interface Reciter {
  id: string;
  name: string;
  arabicName: string;
  everyAyahPath: string;
}

export interface HadithDhikr {
  text: string;
  source: string;
  type: 'hadith' | 'dhikr';
}

export type ViewKey = 'home' | 'quran' | 'challenges' | 'settings';
