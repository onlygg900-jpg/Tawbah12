import { useEffect, useState } from 'react';
import { ArrowLeft, Sun, Moon, Book, Sparkles, RotateCw, Bell } from 'lucide-react';
import { SectionCard } from '@/components/ui';
import {
  getMorningDhikr,
  getEveningDhikr,
  getAfterPrayerDhikr,
  getDailyHadith,
  getRandomDhikr,
} from '@/services/dhikrService';
import { requestNotificationPermission, describePermission, notifyDhikr } from '@/services/notificationService';
import { useApp } from '@/context/AppContext';
import type { HadithDhikr, ViewKey } from '@/types';

interface Props {
  onChange?: (v: ViewKey) => void;
}

type CategoryKey = 'morning' | 'evening' | 'after' | 'hadith' | 'random';

const CATEGORIES: { key: CategoryKey; label: string; icon: typeof Sun; color: string }[] = [
  { key: 'morning', label: 'أذكار الصباح', icon: Sun, color: 'from-amber-400 to-orange-500' },
  { key: 'evening', label: 'أذكار المساء', icon: Moon, color: 'from-indigo-500 to-purple-600' },
  { key: 'after', label: 'أذكار بعد الصلاة', icon: Book, color: 'from-emerald to-teal-600' },
  { key: 'hadith', label: 'أحاديث شريفة', icon: Sparkles, color: 'from-gold to-gold-dark' },
  { key: 'random', label: 'أذكار متنوعة', icon: RotateCw, color: 'from-sky-500 to-blue-600' },
];

const MORNING_FULL: HadithDhikr[] = [
  { text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ. لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.', source: 'صحيح مسلم', type: 'dhikr' },
  { text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ.', source: 'الترمذي - حسن', type: 'dhikr' },
  { text: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ. أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.', source: 'البخاري - قلت دعاء الاستفتاح', type: 'dhikr' },
  { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ مِائَةَ مَرَّةٍ: حُطَّتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ.', source: 'متفق عليه', type: 'dhikr' },
  { text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ عَشْرَ مَرَّاتٍ: كَانَتْ لَهُ عَدْلَ عَشْرِ رِقَبَةٍ، وَكُتِبَتْ لَهُ مِائَةُ حَسَنَةٍ، وَمُحِيَتْ عَنْهُ مِائَةُ سَيِّئَةٍ، وَكَانَتْ لَهُ حِرْزًا مِنَ الشَّيْطَانِ يَوْمَهُ ذَلِكَ حَتَّى يُمْسِيَ.', source: 'البخاري ومسلم', type: 'dhikr' },
  { text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا.', source: 'ابن ماجه - صحيح', type: 'dhikr' },
  { text: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ أَبَدًا.', source: 'الترمذي - حسن صحيح', type: 'dhikr' },
  { text: 'أَعُوذُ بِاللَّهِ السَّمِيعِ الْعَلِيمِ مِنَ الشَّيْطَانِ الرَّجِيمِ: مِنْ هَمْزِهِ وَنَفْخِهِ وَنَفْثِهِ. (ثلاث مرات)', source: 'أبو داود، مسلم، الترمذي', type: 'dhikr' },
  { text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ. (ثلاث مرات)', source: 'أبو داود والترمذي - صحيح', type: 'dhikr' },
  { text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا. (ثلاث مرات)', source: 'أبو داود والترمذي - صحيح', type: 'dhikr' },
];

const EVENING_FULL: HadithDhikr[] = [
  { text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ. لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.', source: 'صحيح مسلم', type: 'dhikr' },
  { text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ.', source: 'الترمذي - حسن', type: 'dhikr' },
  { text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ. (ثلاث مرات)', source: 'مسلم', type: 'dhikr' },
  { text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي.', source: 'أبو داود - حسن', type: 'dhikr' },
  { text: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَهَ إِلَّا أَنْتَ.', source: 'أبو داود، صحيح', type: 'dhikr' },
  { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ: كَانَتْ لَهُ حُرَّةً مِنَ النَّارِ.', source: 'البخاري ومسلم', type: 'dhikr' },
  { text: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ. (مائة مرة)', source: 'أبو داود والترمذي - صحيح', type: 'dhikr' },
  { text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ. (عشر مرات)', source: 'مسلم', type: 'dhikr' },
];

const AFTER_PRAYER_FULL: HadithDhikr[] = [
  { text: 'أَسْتَغْفِرُ اللَّهَ (ثلاث مرات). اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ.', source: 'مسلم', type: 'dhikr' },
  { text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.', source: 'مسلم', type: 'dhikr' },
  { text: 'سُبْحَانَ اللَّهِ (ثلاثاً وثلاثين)، الْحَمْدُ لِلَّهِ (ثلاثاً وثلاثين)، اللَّهُ أَكْبَرُ (ثلاثاً وثلاثين). فَإِنْ كَانَ مِائَةً فَهُوَ خَيْرٌ لَهُ، وَإِنْ نَقَصَ فَهُوَ فِلٌّ فِلٌّ.', source: 'مسلم', type: 'dhikr' },
  { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ مِائَةَ مَرَّةٍ.', source: 'مسلم', type: 'dhikr' },
  { text: 'شَهِدَ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، وَأَنَّ عِيسَى عَبْدُ اللَّهِ وَرَسُولُهُ وَكَلِمَتُهُ أَلْقَاهَا إِلَى مَرْيَمَ وَرُوحٌ مِنْهُ، وَأَنَّ الْجَنَّةَ حَقٌّ وَأَنَّ النَّارَ حَقٌّ: غَفَرَ اللَّهُ لَهُ وَإِنْ كَانَ مُشْرِكًا لَقَانِتًا.', source: 'مسلم', type: 'dhikr' },
];

const HADITH_FULL: HadithDhikr[] = [
  { text: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى. فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ، وَمَنْ كَانَتْ هِجْرَتُهُ لِدُنْيَا يُصِيبُهَا أَوْ امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ.', source: 'البخاري ومسلم', type: 'hadith' },
  { text: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ.', source: 'البخاري ومسلم', type: 'hadith' },
  { text: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ، وَالْمُهَاجِرُ مَنْ هَجَرَ مَا نَهَى اللَّهُ عَنْهُ.', source: 'البخاري', type: 'hadith' },
  { text: 'مَنْ لَا يَرْحَمُ النَّاسَ لَا يَرْحَمُهُ اللَّهُ.', source: 'البخاري ومسلم', type: 'hadith' },
  { text: 'الطَّهُورُ شَطْرُ الْإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلأُ الْمِيزَانَ، وَسُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ تَمْلَآنِ أَوْ تَمْلَأُ مَا بَيْنَ السَّمَاوَاتِ وَالْأَرْضَ.', source: 'مسلم', type: 'hadith' },
  { text: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ.', source: 'مسلم', type: 'hadith' },
  { text: 'كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ ثَقِيلَتَانِ فِي الْمِيزَانِ حَبِيبَتَانِ إِلَى الرَّحْمَنِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ.', source: 'البخاري ومسلم', type: 'hadith' },
  { text: 'مَنْ صَلَّى عَلَيَّ صَلَاةً صَلَّى اللَّهُ عَلَيْهِ بِهَا عَشْرًا، وَحَطَّ عَنْهُ عَشْرَ خَطَايَا، وَرَفَعَ لَهُ عَشْرَ دَرَجَاتٍ.', source: 'الترمذي - صحيح', type: 'hadith' },
  { text: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ، وَتَأْمُرُ بِالْمَعْرُوفِ لَكَ صَدَقَةٌ، وَتَنْهَى عَنِ الْمُنْكَرِ لَكَ صَدَقَةٌ، وَإِرْشَادُكَ الرَّجُلَ فِي أَرْضِ لَجَاجَةٍ لَكَ صَدَقَةٌ، وَمَشْيُكَ إِلَى الصَّلَاةِ لَكَ صَدَقَةٌ، وَكُفُّكَ عَنِ الضَّيِّعِ لَكَ صَدَقَةٌ.', source: 'الترمذي - صحيح', type: 'hadith' },
  { text: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ، وَأَحَبُّهُمْ إِلَى اللَّهِ أَطْوَلُهُمْ نَفْعًا لِلنَّاسِ.', source: 'أحمد - حسن', type: 'hadith' },
  { text: 'مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا نَفَّسَ اللَّهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ، وَمَنْ سَتَرَ مُسْلِمًا سَتَرَهُ اللَّهُ يَوْمَ الْقِيَامَةِ.', source: 'مسلم', type: 'hadith' },
  { text: 'لا تَحْقِرَنَّ مِنَ الْمَعْرُوفِ شَيْئًا، وَلَوْ أَنْ تَلْقَى أَخَاكَ بِوَجْهٍ طَلْبٍ.', source: 'مسلم', type: 'hadith' },
  { text: 'إِذَا مَاتَ الْإِنْسَانُ انْقَطَعَ عَمَلُهُ إِلَّا مِنْ ثَلَاثٍ: صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ.', source: 'مسلم', type: 'hadith' },
  { text: 'الدُّنْيَا سِجْنُ الْمُؤْمِنِ وَجَنَّةُ الْكَافِرِ.', source: 'مسلم', type: 'hadith' },
  { text: 'إِنَّمَا يُقْبَلُ الْعَمَلُ بِالنِّيَّةِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى.', source: 'صحيح الإمام أحمد', type: 'hadith' },
];

function pickItems(items: HadithDhikr[], seedStr = ''): HadithDhikr[] {
  const sorted = [...items];
  if (seedStr) {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let i = sorted.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
  }
  return sorted;
}

export default function AdhkarView({ onChange }: Props) {
  const { settings, updateSettings } = useApp();
  const [category, setCategory] = useState<CategoryKey>('morning');
  const [items, setItems] = useState<HadithDhikr[]>(() =>
    pickItems(MORNING_FULL, new Date().toISOString().slice(0, 10))
  );
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  useEffect(() => {
    const key = new Date().toISOString().slice(0, 10);
    switch (category) {
      case 'morning':
        setItems(pickItems(MORNING_FULL, key));
        break;
      case 'evening':
        setItems(pickItems(EVENING_FULL, key));
        break;
      case 'after':
        setItems(pickItems(AFTER_PRAYER_FULL, key));
        break;
      case 'hadith':
        setItems(pickItems(HADITH_FULL, key));
        break;
      case 'random':
        setItems(
          pickItems([...MORNING_FULL, ...EVENING_FULL, ...AFTER_PRAYER_FULL, ...HADITH_FULL])
        );
        break;
    }
  }, [category]);

  const handleEnableNotifs = async () => {
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === 'granted') {
      updateSettings({
        notifications: {
          ...settings.notifications,
          enabled: true,
          morningAdhkar: true,
          eveningAdhkar: true,
          afterPrayerAdhkar: true,
          dailyHadith: true,
        },
      });
      notifyDhikr('periodic');
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
          <h1 className="text-2xl font-extrabold text-emerald dark:text-gold-light">
            الحديث والأذكار
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            أذكار يومية وأحاديث شريفة من السنة المطهّرة
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95 ${
                active
                  ? `bg-gradient-to-r ${c.color} text-white shadow-lg`
                  : 'card text-slate-700 dark:text-slate-200 hover:shadow'
              }`}
            >
              <Icon size={16} /> {c.label}
            </button>
          );
        })}
      </div>

      <div className="card p-4 bg-gradient-to-l from-emerald/10 to-transparent dark:from-gold/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Bell size={18} className="text-emerald dark:text-gold-light" />
              إشعارات الأذكار المتكرّرة
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              الحالة: <span className="font-semibold">{describePermission(notifPerm)}</span> ·
              تذكير كل 10 - 15 دقيقة تقريبًا
            </p>
          </div>
          {notifPerm !== 'granted' ? (
            <button onClick={handleEnableNotifs} className="btn-gold text-sm !py-2">
              تفعيل
            </button>
          ) : (
            <button
              onClick={() => notifyDhikr('periodic')}
              className="btn-primary text-sm !py-2"
            >
              اختبار
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={`${category}-${i}`}
            className={`card p-4 transition hover:shadow-md animate-fade-in ${
              item.type === 'hadith'
                ? 'border-gold/40 bg-gradient-to-br from-gold/5 via-white to-gold/5 dark:from-gold/10 dark:via-emerald-deep/60 dark:to-gold/5'
                : 'bg-white dark:bg-emerald-deep/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="pill bg-emerald/10 dark:bg-gold/15 text-emerald dark:text-gold-light text-[10px] font-bold px-2.5 py-1">
                {i + 1}
              </span>
              <span className="pill bg-slate-100 dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2.5 py-1">
                {item.type === 'hadith' ? 'حديث' : 'ذكر'}
              </span>
            </div>
            <p className="quran-text text-xl leading-loose text-slate-800 dark:text-slate-100">
              {item.text}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs font-bold text-gold-dark dark:text-gold-light flex items-center gap-1">
                <Sparkles size={12} /> — {item.source}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
