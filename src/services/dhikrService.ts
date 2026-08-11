import type { HadithDhikr } from '@/types';

const MORNING_DHIKR: HadithDhikr[] = [
  { text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ.', source: 'مسلم', type: 'dhikr' },
  { text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ.', source: 'الترمذي', type: 'dhikr' },
  { text: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ.', source: 'البخاري', type: 'dhikr' },
  { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ (مائة مرة).', source: 'مسلم', type: 'dhikr' },
  { text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ (عشر مرات).', source: 'البخاري', type: 'dhikr' },
];

const EVENING_DHIKR: HadithDhikr[] = [
  { text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ.', source: 'مسلم', type: 'dhikr' },
  { text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ.', source: 'الترمذي', type: 'dhikr' },
  { text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ (ثلاث مرات).', source: 'مسلم', type: 'dhikr' },
  { text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ.', source: 'أبو داود', type: 'dhikr' },
];

const AFTER_PRAYER_DHIKR: HadithDhikr[] = [
  { text: 'أَسْتَغْفِرُ اللَّهَ (ثلاث مرات)، اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ.', source: 'مسلم', type: 'dhikr' },
  { text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.', source: 'مسلم', type: 'dhikr' },
  { text: 'سُبْحَانَ اللَّهِ (ثلاثاً وثلاثين)، الْحَمْدُ لِلَّهِ (ثلاثاً وثلاثين)، اللَّهُ أَكْبَرُ (ثلاثاً وثلاثين).', source: 'مسلم', type: 'dhikr' },
];

const DAILY_HADITH: HadithDhikr[] = [
  { text: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى.', source: 'البخاري ومسلم', type: 'hadith' },
  { text: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ.', source: 'البخاري ومسلم', type: 'hadith' },
  { text: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ.', source: 'البخاري', type: 'hadith' },
  { text: 'مَنْ لَا يَرْحَمُ النَّاسَ لَا يَرْحَمُهُ اللَّهُ.', source: 'البخاري ومسلم', type: 'hadith' },
  { text: 'الطَّهُورُ شَطْرُ الْإِيمَانِ.', source: 'مسلم', type: 'hadith' },
  { text: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ.', source: 'مسلم', type: 'hadith' },
  { text: 'كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ ثَقِيلَتَانِ فِي الْمِيزَانِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ.', source: 'البخاري', type: 'hadith' },
  { text: 'مَنْ صَلَّى عَلَيَّ صَلَاةً صَلَّى اللَّهُ عَلَيْهِ بِهَا عَشْرًا.', source: 'مسلم', type: 'hadith' },
  { text: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ.', source: 'الترمذي', type: 'hadith' },
  { text: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ.', source: 'أحمد', type: 'hadith' },
];

const ALL_DHIKR = [...MORNING_DHIKR, ...EVENING_DHIKR, ...AFTER_PRAYER_DHIKR];

function pickByDay(items: HadithDhikr[]): HadithDhikr {
  const dayOfYear = Math.floor(Date.now() / 86_400_000);
  return items[dayOfYear % items.length];
}

export function getRandomDhikr(): HadithDhikr {
  return ALL_DHIKR[Math.floor(Math.random() * ALL_DHIKR.length)];
}

export function getMorningDhikr(): HadithDhikr {
  return pickByDay(MORNING_DHIKR);
}

export function getEveningDhikr(): HadithDhikr {
  return pickByDay(EVENING_DHIKR);
}

export function getAfterPrayerDhikr(): HadithDhikr {
  return pickByDay(AFTER_PRAYER_DHIKR);
}

export function getDailyHadith(): HadithDhikr {
  return pickByDay(DAILY_HADITH);
}
