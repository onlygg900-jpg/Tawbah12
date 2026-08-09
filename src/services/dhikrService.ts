import type { HadithDhikr } from '@/types';

const MORNING_DHIKR: HadithDhikr[] = [
  { text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', source: 'مسلم' },
  { text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ', source: 'الترمذي' },
  { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ سُبْحَانَ اللَّهِ الْعَظِيمِ', source: 'البخاري ومسلم' },
];

const EVENING_DHIKR: HadithDhikr[] = [
  { text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', source: 'مسلم' },
  { text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ', source: 'الترمذي' },
  { text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', source: 'مسلم' },
];

const AFTER_PRAYER_DHIKR: HadithDhikr[] = [
  { text: 'أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ', source: 'مسلم' },
  { text: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ', source: 'مسلم' },
  { text: 'سُبْحَانَ اللَّهِ ثَلَاثًا وَثَلَاثِينَ، وَالْحَمْدُ لِلَّهِ ثَلَاثًا وَثَلَاثِينَ، وَاللَّهُ أَكْبَرُ ثَلَاثًا وَثَلَاثِينَ', source: 'مسلم' },
];

const DAILY_HADITH: HadithDhikr[] = [
  { text: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى', source: 'البخاري ومسلم' },
  { text: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', source: 'البخاري ومسلم' },
  { text: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ', source: 'البخاري' },
  { text: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', source: 'البخاري ومسلم' },
  { text: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ', source: 'مسلم' },
  { text: 'كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي الْمِيزَانِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ', source: 'البخاري ومسلم' },
  { text: 'الطُّهُورُ شَطْرُ الْإِيمَانِ', source: 'مسلم' },
  { text: 'مَنْ لَا يَرْحَمُ النَّاسَ لَا يَرْحَمُهُ اللَّهُ', source: 'البخاري ومسلم' },
];

function pickByDate(items: HadithDhikr[]): HadithDhikr {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return items[dayOfYear % items.length];
}

function pickRandom(items: HadithDhikr[]): HadithDhikr {
  return items[Math.floor(Math.random() * items.length)];
}

export function getMorningDhikr(): HadithDhikr {
  return pickByDate(MORNING_DHIKR);
}

export function getEveningDhikr(): HadithDhikr {
  return pickByDate(EVENING_DHIKR);
}

export function getAfterPrayerDhikr(): HadithDhikr {
  return pickByDate(AFTER_PRAYER_DHIKR);
}

export function getDailyHadith(): HadithDhikr {
  return pickByDate(DAILY_HADITH);
}

export function getRandomDhikr(): HadithDhikr {
  const all = [...MORNING_DHIKR, ...EVENING_DHIKR, ...AFTER_PRAYER_DHIKR, ...DAILY_HADITH];
  return pickRandom(all);
}
