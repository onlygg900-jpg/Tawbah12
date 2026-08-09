import type { Surah, Reciter } from '@/types';

const API_BASE = import.meta.env.VITE_QURAN_API_BASE || 'https://api.quran.com/api/v4';

export interface ChaptersResponse {
  chapters: Array<{
    id: number;
    name_simple: string;
    name_arabic: string;
    revelation_place: string;
    verses_count: number;
    pages: string;
  }>;
}

export async function fetchSurahs(): Promise<Surah[]> {
  const res = await fetch(`${API_BASE}/chapters`);
  if (!res.ok) throw new Error(`تعذّر جلب قائمة السور (${res.status})`);
  const json: ChaptersResponse = await res.json();
  const chapters = json?.chapters ?? [];
  if (chapters.length === 0) throw new Error('لم يتم العثور على سور في الاستجابة');
  return chapters.map((c) => ({
    id: c.id,
    name: c.name_arabic,
    englishName: c.name_simple,
    arabicName: c.name_arabic,
    revelationPlace: c.revelation_place,
    versesCount: c.verses_count,
    pages: c.pages,
  }));
}

export interface Ayah {
  number: number;
  text: string;
  verseKey: string;
  page: number;
}

// Approximate start page per surah (Mushaf al-Madinah, 604 pages).
// Used as a fallback when the API doesn't return page_number for a verse.
const SURAH_START_PAGES: Record<number, number> = {
  1: 1, 2: 2, 3: 50, 4: 77, 5: 106, 6: 128, 7: 151, 8: 177, 9: 187, 10: 208,
  11: 221, 12: 235, 13: 249, 14: 255, 15: 262, 16: 267, 17: 282, 18: 293, 19: 305,
  20: 312, 21: 322, 22: 332, 23: 342, 24: 350, 25: 359, 26: 367, 27: 377, 28: 385,
  29: 396, 30: 404, 31: 411, 32: 415, 33: 418, 34: 428, 35: 434, 36: 440, 37: 446,
  38: 449, 39: 454, 40: 467, 41: 477, 42: 483, 43: 489, 44: 496, 45: 499, 46: 502,
  47: 507, 48: 511, 49: 515, 50: 518, 51: 520, 52: 523, 53: 526, 54: 528, 55: 531,
  56: 534, 57: 537, 58: 542, 59: 545, 60: 549, 61: 551, 62: 553, 63: 554, 64: 556,
  65: 558, 66: 560, 67: 562, 68: 564, 69: 566, 70: 568, 71: 570, 72: 572, 73: 574,
  74: 575, 75: 577, 76: 578, 77: 580, 78: 582, 79: 583, 80: 585, 81: 586, 82: 587,
  83: 587, 84: 589, 85: 590, 86: 591, 87: 592, 88: 593, 89: 594, 90: 595, 91: 596,
  92: 597, 93: 597, 94: 598, 95: 598, 96: 599, 97: 599, 98: 600, 99: 601, 100: 601,
  101: 602, 102: 602, 103: 603, 104: 603, 105: 603, 106: 604, 107: 604, 108: 604,
  109: 604, 110: 604, 111: 604, 112: 604, 113: 604, 114: 604,
};

interface RawVerse {
  id?: number;
  verse_key?: string;
  text_uthmani?: string;
  page_number?: number;
}

export async function fetchAyahs(surahId: number): Promise<Ayah[]> {
  const url = `${API_BASE}/quran/verses/uthmani?chapter_number=${surahId}&fields=verse_key,text_uthmani,page_number`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`تعذّر جلب الآيات (${res.status})`);
  const json: unknown = await res.json();
  // API returns { verses: [...] } at top level; guard against alternate shapes.
  const verses: RawVerse[] = (json as { verses?: RawVerse[] })?.verses ?? [];
  if (verses.length === 0) {
    throw new Error('لم يتم العثور على آيات في الاستجابة. تحقق من اتصالك بالإنترنت.');
  }
  const startPage = SURAH_START_PAGES[surahId] ?? 1;
  return verses.map((v, i) => ({
    number: i + 1,
    text: v.text_uthmani ?? '',
    verseKey: v.verse_key ?? `${surahId}:${i + 1}`,
    page: v.page_number ?? startPage + Math.floor(i / 10),
  }));
}

let fullQuranCache: Ayah[] | null = null;

export async function fetchAllAyahs(): Promise<Ayah[]> {
  if (fullQuranCache) return fullQuranCache;
  const url = `${API_BASE}/quran/verses/uthmani?fields=verse_key,text_uthmani,page_number`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`تعذّر جلب نص القرآن (${res.status})`);
  const json: unknown = await res.json();
  const verses: RawVerse[] = (json as { verses?: RawVerse[] })?.verses ?? [];
  if (verses.length === 0) {
    throw new Error('لم يتم العثور على الآيات في الاستجابة. تحقق من اتصالك بالإنترنت.');
  }
  fullQuranCache = verses.map((v) => {
    const [surahIdStr, ayahStr] = (v.verse_key ?? '1:1').split(':');
    const surahId = Number(surahIdStr) || 1;
    const ayahNumber = Number(ayahStr) || 1;
    return {
      number: ayahNumber,
      text: v.text_uthmani ?? '',
      verseKey: v.verse_key ?? `${surahId}:${ayahNumber}`,
      page: v.page_number ?? SURAH_START_PAGES[surahId] ?? 1,
    };
  });
  return fullQuranCache;
}

export async function fetchAyahsByPage(page: number): Promise<Ayah[]> {
  const verses = await fetchAllAyahs();
  return verses.filter((v) => v.page === page);
}

export async function fetchTafsir(surahId: number, ayahNumber: number): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/resources/tafsirs?language=ar`);
    if (!res.ok) throw new Error('tafsir list failed');
    const json: { tafsirs?: Array<{ id: number; name: string }> } = await res.json();
    const tafsirId =
      json?.tafsirs?.find((t) => t.name.includes('Muyassar') || t.name.includes('ميسر'))?.id ?? 16;
    const vRes = await fetch(`${API_BASE}/tafsirs/${tafsirId}/by_ayah/${surahId}:${ayahNumber}`);
    if (!vRes.ok) throw new Error('tafsir fetch failed');
    const vJson: { tafsir?: { text?: string } } = await vRes.json();
    const text: string = vJson?.tafsir?.text ?? 'لا يوجد تفسير متاح حالياً.';
    // strip HTML spans for cleaner display
    return text.replace(/<[^>]+>/g, '');
  } catch {
    return 'تعذّر جلب التفسير حالياً. تحقق من اتصالك بالإنترنت.';
  }
}

export const RECITERS: Reciter[] = [
  { id: 'afasy', name: 'Mishary Alafasy', arabicName: 'مشاري العفاسي', everyAyahPath: 'Alafasy_128kbps' },
  { id: 'minshawi', name: 'Minshawi Murattal', arabicName: 'المنشاوي', everyAyahPath: 'Minshawy_Murattal_128kbps' },
  { id: 'husary', name: 'Husary', arabicName: 'الحصري', everyAyahPath: 'Husary_128kbps' },
  { id: 'sudais', name: 'Sudais', arabicName: 'عبد الرحمن السديس', everyAyahPath: 'Abdurrahmaan_As-Sudais_128kbps' },
  { id: 'basit_mujawwad', name: 'Abdul Basit Mujawwad', arabicName: 'عبد الباسط مجود', everyAyahPath: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'shuraim', name: 'Shuraim', arabicName: 'سعود الشريم', everyAyahPath: 'Saood_ash-Shuraym_128kbps' },
];

export function ayahAudioUrl(reciterPath: string, surahId: number, ayah: number): string {
  const s = String(surahId).padStart(3, '0');
  const a = String(ayah).padStart(3, '0');
  const base = import.meta.env.VITE_EVERYAYAH_BASE || 'https://everyayah.com/data';
  return `${base}/${reciterPath}/${s}${a}.mp3`;
}

// Fallback audio source using the Quran.com CDN (ayah-by-ayah).
// Format: https://audio.qurancdn.com/{reciter}/ayah/{surah}:{ayah}.mp3
export function ayahAudioFallbackUrl(reciter: Reciter, surahId: number, ayah: number): string {
  const map: Record<string, string> = {
    afasy: 'Alafasy_128kbps',
    minshawi: 'Minshawy_Murattal_128kbps',
    husary: 'Husary_128kbps',
    sudais: 'Abdurrahmaan_As-Sudais_128kbps',
    basit_mujawwad: 'Abdul_Basit_Murattal_192kbps',
    shuraim: 'Saood_ash-Shuraym_128kbps',
  };
  const slug = map[reciter.id] ?? 'Alafasy_128kbps';
  return `https://audio.qurancdn.com/${slug}/ayah/${surahId}:${ayah}.mp3`;
}
