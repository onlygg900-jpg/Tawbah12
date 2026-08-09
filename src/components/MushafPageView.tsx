import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Pause,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { fetchAyahsByPage, RECITERS, ayahAudioUrl, ayahAudioFallbackUrl } from '@/services/quranService';
import type { Ayah } from '@/services/quranService';
import type { Surah, Reciter } from '@/types';

interface MushafPageViewProps {
  page: number;
  surahs: Surah[];
  onBack: () => void;
  onPageChange?: (page: number) => void;
  khatmaId?: string | null;
}

export default function MushafPageView({ page: initialPage, surahs, onBack, onPageChange, khatmaId }: MushafPageViewProps) {
  const [page, setPage] = useState(initialPage);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reciter, setReciter] = useState<Reciter>(RECITERS[0]);
  const [playing, setPlaying] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(-1);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useMemo(() => ({ current: null as HTMLAudioElement | null }), []);

  const surahForPage = useCallback((p: number): Surah | undefined => {
    return surahs.find((s) => {
      const parts = String(s.pages).split('-').map(Number);
      return p >= parts[0] && p <= (parts[1] || parts[0]);
    });
  }, [surahs]);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAyahsByPage(p);
      if (list.length === 0) {
        throw new Error('لا توجد آيات في هذه الصفحة.');
      }
      setAyahs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل الصفحة');
      setAyahs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    void loadPage(page);
    setCurrentAyahIndex(-1);
    setPlaying(false);
    stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const stopAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {
        // ignore
      }
    }
    setPlaying(false);
  };

  const playAyah = useCallback((index: number, useFallback = false) => {
    if (index < 0 || index >= ayahs.length) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    const audio = audioRef.current;
    const [surahId, ayahNum] = ayahs[index].verseKey.split(':').map(Number);
    const url = useFallback
      ? ayahAudioFallbackUrl(reciter, surahId, ayahNum)
      : ayahAudioUrl(reciter.everyAyahPath, surahId, ayahNum);

    setAudioError(null);
    audio.src = url;
    audio.play()
      .then(() => {
        setPlaying(true);
        setCurrentAyahIndex(index);
      })
      .catch(() => {
        if (!useFallback) {
          playAyah(index, true);
        } else {
          setPlaying(false);
          setAudioError('تعذّر تشغيل الصوت.');
        }
      });

    audio.onended = () => {
      if (index + 1 < ayahs.length) {
        playAyah(index + 1, useFallback);
      } else {
        setPlaying(false);
        setCurrentAyahIndex(-1);
      }
    };

    audio.onerror = () => {
      if (!useFallback) {
        playAyah(index, true);
      } else {
        setPlaying(false);
        setAudioError('تعذّر تشغيل هذه الآية.');
      }
    };
  }, [ayahs, reciter, audioRef]);

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      const start = currentAyahIndex >= 0 ? currentAyahIndex : 0;
      if (ayahs.length > 0) playAyah(start);
    }
  };

  const goToPage = (delta: number) => {
    const next = Math.max(1, Math.min(604, page + delta));
    if (next !== page) {
      setPage(next);
      onPageChange?.(next);
    }
  };

  const currentSurah = surahForPage(page);

  useEffect(() => {
    return () => {
      stopAudio();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
          <ChevronRight size={16} /> العودة
        </button>
        <div className="text-center">
          <p className="text-xl font-bold text-emerald dark:text-gold-light font-quran">
            {currentSurah ? `سورة ${currentSurah.arabicName}` : 'القرآن الكريم'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            صفحة <span className="font-bold text-emerald dark:text-gold-light">{page}</span> من 604
            {khatmaId && ' · ختمة نشطة'}
          </p>
        </div>
        <select
          value={reciter.id}
          onChange={(e) => {
            const r = RECITERS.find((rr) => rr.id === e.target.value) || RECITERS[0];
            setReciter(r);
            if (playing) {
              stopAudio();
              setCurrentAyahIndex(-1);
            }
          }}
          className="input max-w-[160px] py-1.5 text-sm"
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>{r.arabicName}</option>
          ))}
        </select>
      </div>

      <div className="card sticky top-2 z-10 flex items-center gap-2 p-3 shadow-lg">
        <button onClick={() => goToPage(-1)} disabled={page <= 1} className="btn-ghost p-2 disabled:opacity-40" aria-label="صفحة سابقة">
          <ChevronRight size={18} />
        </button>
        <button onClick={togglePlay} className="btn-primary p-3" disabled={ayahs.length === 0}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={() => goToPage(1)} disabled={page >= 604} className="btn-ghost p-2 disabled:opacity-40" aria-label="الصفحة التالية">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-emerald dark:text-gold-light">
            {currentAyahIndex >= 0 ? `الآية ${ayahs[currentAyahIndex]?.verseKey}` : 'اضغط تشغيل للبدء'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {audioError ? <span className="text-red-400">{audioError}</span> : reciter.arabicName}
          </p>
        </div>
      </div>

      {error && (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => loadPage(page)} className="btn-ghost text-sm">إعادة</button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <Loader2 size={28} className="animate-spin text-emerald dark:text-gold-light" />
          <p className="text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الصفحة...</p>
        </div>
      ) : (
        <div className="card p-5 sm:p-8">
          <p className="quran-text mb-4 text-center text-xl text-emerald dark:text-gold-light">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
          <div className="quran-text text-xl leading-loose text-slate-800 dark:text-slate-100">
            {ayahs.map((a, i) => {
              const isActive = currentAyahIndex === i;
              return (
                <span
                  key={a.verseKey}
                  className={`inline-block cursor-pointer rounded-xl px-1.5 py-0.5 my-0.5 transition-all duration-300 border-2 ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-50/10 dark:border-gold dark:bg-gold/15 shadow-md'
                      : 'border-transparent hover:bg-emerald-50/5 dark:hover:bg-gold/5'
                  }`}
                  onClick={() => {
                    if (playing && currentAyahIndex === i) {
                      audioRef.current?.pause();
                      setPlaying(false);
                    } else {
                      playAyah(i);
                    }
                  }}
                >
                  {a.text}
                  <span className="mx-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold bg-emerald/10 text-emerald dark:bg-gold/20 dark:text-gold-light">
                    ﴿{a.number}﴾
                  </span>{' '}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pb-4">
        <button onClick={() => goToPage(-1)} disabled={page <= 1} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">
          <ChevronRight size={16} /> صفحة سابقة
        </button>
        <button onClick={() => goToPage(1)} disabled={page >= 604} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">
          صفحة تالية <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
}
