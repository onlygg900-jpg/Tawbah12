import { useEffect, useState, useMemo, useRef } from 'react';
import {
  BookOpen,
  Search,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  BookText,
  Loader2,
  Copy,
  Check,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fetchSurahs, fetchAyahs, fetchAllAyahs, fetchTafsir, RECITERS, ayahAudioUrl, ayahAudioFallbackUrl } from '@/services/quranService';
import type { Ayah } from '@/services/quranService';
import type { Surah, Reciter, QuranKhatma } from '@/types';
import { SectionCard, ErrorBanner, LoadingSpinner, Modal, EmptyState } from '@/components/ui';

type SubView = 'list' | 'reader' | 'khatma';

export default function QuranView() {
  const [subView, setSubView] = useState<SubView>('list');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [activeKhatmaId, setActiveKhatmaId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [allAyahs, setAllAyahs] = useState<Ayah[]>([]);

  const normalizePage = (value: number | string | null | undefined) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 1;
    return Math.max(1, Math.min(604, Math.floor(parsed)));
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSurahs();
      setSurahs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل السور');
    } finally {
      setLoading(false);
    }
  };

  const loadAllAyahs = async () => {
    if (allAyahs.length > 0) return allAyahs;
    const verses = await fetchAllAyahs();
    setAllAyahs(verses);
    return verses;
  };

  const findSurahByPage = (page: number) => {
    return surahs.find((s) => {
      const pages = String(s.pages).split('-').map(Number);
      return page >= pages[0] && page <= (pages[1] || pages[0]);
    });
  };

  const parseVerseKey = (value: string) => {
    const normalized = value.trim().replace('٫', ':').replace(' ', '');
    const match = normalized.match(/^(\d{1,3})[:](\d{1,3})$/);
    if (!match) return null;
    return { surah: Number(match[1]), ayah: Number(match[2]) };
  };

  const handleSearch = async (value: string) => {
    const q = value.trim();
    if (!q) {
      setSearchError(null);
      return;
    }

    setSearchError(null);
    setSearching(true);
    try {
      const pageNumber = Number(q);
      if (Number.isFinite(pageNumber) && !Number.isNaN(pageNumber)) {
        const foundSurah = surahs.find((s) => s.id === pageNumber);
        if (foundSurah) {
          openSurah(foundSurah);
          return;
        }
        if (pageNumber >= 1 && pageNumber <= 604) {
          setSearchError('يمكنك البحث برقم السورة بين 1 و 114، أو بواسطة نص السورة أو الآية.');
          return;
        }
      }

      const foundSurah = surahs.find(
        (s) =>
          s.id === Number(q) ||
          s.arabicName === q ||
          s.arabicName.includes(q) ||
          s.englishName.toLowerCase().includes(q.toLowerCase())
      );
      if (foundSurah) {
        openSurah(foundSurah);
        return;
      }

      const verses = await loadAllAyahs();
      const verseRef = parseVerseKey(q);
      if (verseRef) {
        const verse = verses.find((v) => {
          const [surahId, ayahNumber] = v.verseKey.split(':').map(Number);
          return surahId === verseRef.surah && ayahNumber === verseRef.ayah;
        });
        if (verse) {
          openPage(verse.page);
          return;
        }
      }

      const match = verses.find((v) =>
        v.text.includes(q) ||
        v.verseKey === q ||
        v.verseKey.replace(':', '') === q.replace(/\s+/g, '')
      );
      if (match) {
        openPage(match.page);
        return;
      }

      setSearchError('لم يتم العثور على صفحة تحتوي على هذا البحث.');
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'حدث خطأ في البحث');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return surahs;
    const q = query.trim();
    return surahs.filter(
      (s) =>
        s.arabicName.includes(q) ||
        s.englishName.toLowerCase().includes(q.toLowerCase()) ||
        String(s.id) === q
    );
  }, [surahs, query]);

  const openPage = (page: number, khatmaId?: string) => {
    const normalizedPage = normalizePage(page);
    const matchedSurah = findSurahByPage(normalizedPage);
    setSelectedSurahId(matchedSurah?.id ?? null);
    setActiveKhatmaId(khatmaId ?? null);
    setSubView('reader');
  };

  const openSurah = (s: Surah) => {
    setSelectedSurahId(s.id);
    setActiveKhatmaId(null);
    setSubView('reader');
  };

  return (
    <div className="p-4 pb-24 animate-fade-in">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1 rounded-xl bg-emerald dark:bg-emerald-soft/40 p-1">
          <div className="flex gap-1">
            {[
              { k: 'list' as const, l: 'السور', i: <BookOpen size={14} /> },
              { k: 'khatma' as const, l: 'التختيم', i: <Target size={14} /> },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setSubView(t.k)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition ${
                  subView === t.k
                    ? 'bg-white dark:bg-emerald-deep text-emerald dark:text-gold-light shadow'
                    : 'text-white/80 dark:text-slate-300'
                }`}
              >
                {t.i} {t.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {subView === 'list' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSearch(query);
                }
              }}
              placeholder="ابحث عن سورة، صفحة، آية برقمها أو نص القرآن..."
              className="input pr-10"
            />
          </div>
          {searchError && <p className="text-sm text-red-500">{searchError}</p>}
          {searching && <p className="text-sm text-slate-500">جارٍ البحث...</p>}
          {error && <ErrorBanner message={error} onRetry={load} />}
          {loading ? (
            <LoadingSpinner label="جارٍ تحميل السور..." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSurah(s)}
                  className="card flex items-center justify-between p-3 text-right transition hover:border-emerald/40 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center">
                      <span className="text-emerald/20 dark:text-gold-light/30 text-2xl"></span>
                      <span className="absolute text-xs font-bold text-emerald dark:text-gold-light">{s.id}</span>
                    </div>
                    <div>
                      <p className="font-bold text-lg text-emerald dark:text-gold-light font-quran">{s.arabicName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {s.englishName} · {s.versesCount} آية · {s.revelationPlace === 'makkah' ? 'مكية' : 'مدنية'}
                      </p>
                    </div>
                  </div>
                  <ChevronLeft className="text-slate-400" size={18} />
                </button>
              ))}
              {filtered.length === 0 && (
                <EmptyState icon={<BookOpen size={40} />} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى" />
              )}
            </div>
          )}
        </div>
      )}

      {subView === 'reader' && selectedSurahId !== null && (
        <QuranReader
          surahId={selectedSurahId}
          onBack={() => setSubView('list')}
          onSurahChange={setSelectedSurahId}
          surahs={surahs}
        />
      )}

      {subView === 'khatma' && <KhatmaTracker onOpenSurah={openSurah} onOpenPage={openPage} surahs={surahs} />}
    </div>
  );
}

interface QuranReaderProps {
  surahId: number;
  onBack: () => void;
  onSurahChange: (surahId: number) => void;
  surahs: Surah[];
}

function QuranReader({ surahId, onBack, onSurahChange, surahs }: QuranReaderProps) {
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reciter, setReciter] = useState<Reciter>(RECITERS[0]);
  const [playing, setPlaying] = useState(false);
  const [currentAyah, setCurrentAyah] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<{ index: number; ayah: Ayah } | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tafsir, setTafsir] = useState<{ open: boolean; text: string; loading: boolean; key: string }>({
    open: false,
    text: '',
    loading: false,
    key: '',
  });
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playIndexRef = useRef(0);
  const ayahsRef = useRef<Ayah[]>([]);
  const fallbackRef = useRef(false);
  const scrollTimer = useRef<number | undefined>(undefined);

  const currentSurah = useMemo(() => {
    return surahs.find((s) => s.id === surahId);
  }, [surahId, surahs]);

  const currentSurahIndex = useMemo(() => {
    return surahs.findIndex((s) => s.id === surahId);
  }, [surahId, surahs]);

  const loadAyahs = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAyahs(surahId);
      if (list.length === 0) {
        throw new Error('لم يتم العثور على آيات لهذه السورة.');
      }
      setAyahs(list);
      ayahsRef.current = list;
      const firstPage = list.length > 0 && typeof list[0].page === 'number' && Number.isFinite(list[0].page)
        ? list[0].page
        : (currentSurah ? Number(String(currentSurah.pages).split('-')[0]) || 1 : 1);
      setCurrentPage(firstPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل الآيات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAyahs();
    setCurrentAyah(0);
    setPlaying(false);
    setAudioError(null);
    setSelectedVerse(null);
    setTafsir((t) => ({ ...t, open: false }));
    stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahId]);

  const goToSurah = (offset: number) => {
    const targetIndex = currentSurahIndex + offset;
    const targetSurah = surahs[targetIndex];
    if (targetSurah) {
      onSurahChange(targetSurah.id);
    }
  };

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

  const playAyah = (index: number, useFallback = false) => {
    const list = ayahsRef.current;
    if (index < 0 || index >= list.length) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    const audio = audioRef.current;
    const [surahId, ayahNum] = list[index].verseKey.split(':').map(Number);
    const url = useFallback
      ? ayahAudioFallbackUrl(reciter, surahId, ayahNum)
      : ayahAudioUrl(reciter.everyAyahPath, surahId, ayahNum);

    fallbackRef.current = useFallback;
    playIndexRef.current = index;
    setAudioError(null);
    audio.src = url;
    audio.play()
      .then(() => {
        setPlaying(true);
        setCurrentAyah(index + 1);
        scrollAyahIntoView(index);
      })
      .catch(() => {
        if (!useFallback) {
          playAyah(index, true);
        } else {
          setPlaying(false);
          setAudioError('تعذّر تشغيل الصوت. تحقق من اتصالك بالإنترنت.');
        }
      });

    audio.onended = () => {
      if (playIndexRef.current + 1 < list.length) {
        playAyah(playIndexRef.current + 1, fallbackRef.current);
      } else {
        setPlaying(false);
        setCurrentAyah(0);
        playIndexRef.current = 0;
      }
    };

    audio.onerror = () => {
      if (!useFallback) {
        playAyah(index, true);
      } else {
        setPlaying(false);
        setAudioError('تعذّر تشغيل هذه الآية. حاول مرة أخرى.');
      }
    };
  };

  const scrollAyahIntoView = (index: number) => {
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = document.getElementById(`ayah-${index}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  };

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      if (currentAyah > 0) {
        playAyah(currentAyah - 1, fallbackRef.current);
      } else if (ayahs.length > 0) {
        playAyah(0);
      }
    }
  };

  const nextAyah = () => {
    if (currentAyah < ayahs.length) playAyah(currentAyah, fallbackRef.current);
  };
  const prevAyah = () => {
    if (currentAyah > 1) playAyah(currentAyah - 2, fallbackRef.current);
  };

  const openTafsir = async (ayahNum: number, verseKey: string) => {
    setSelectedVerse(null);
    setTafsir({ open: true, text: '', loading: true, key: verseKey });
    const [surahId] = verseKey.split(':').map(Number);
    const text = await fetchTafsir(surahId, ayahNum);
    setTafsir({ open: true, text, loading: false, key: verseKey });
  };

  const playSingleAyah = (index: number) => {
    if (playing && currentAyah === index + 1) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      playAyah(index, fallbackRef.current);
    }
  };

  const copyVerse = (ayah: Ayah) => {
    const text = `${ayah.text} ﴿${ayah.number}﴾`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    return () => {
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
      stopAudio();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
          <ChevronRight size={16} /> العودة
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToSurah(-1)}
            disabled={currentSurahIndex <= 0}
            className="btn-ghost p-2 disabled:opacity-40"
            aria-label="السورة السابقة"
          >
            <ChevronRight size={16} />
          </button>
          <div className="text-center">
            <p className="text-xl font-bold text-emerald dark:text-gold-light font-quran">
              {currentSurah ? `سورة ${currentSurah.arabicName}` : 'القرآن الكريم'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentSurah
                ? `${currentSurah.englishName} · ${currentSurah.versesCount} آية · صفحة ${currentPage}`
                : 'جارٍ التحميل...'}
            </p>
          </div>
          <button
            onClick={() => goToSurah(1)}
            disabled={currentSurahIndex < 0 || currentSurahIndex >= surahs.length - 1}
            className="btn-ghost p-2 disabled:opacity-40"
            aria-label="السورة التالية"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <select
          value={reciter.id}
          onChange={(e) => {
            const r = RECITERS.find((rr) => rr.id === e.target.value) || RECITERS[0];
            setReciter(r);
            if (playing) {
              stopAudio();
              setCurrentAyah(0);
            }
          }}
          className="input max-w-[160px] py-1.5 text-sm"
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.arabicName}
            </option>
          ))}
        </select>
      </div>

      {ayahs.length > 0 && (
        <div className="card sticky top-2 z-10 flex items-center gap-2 p-3 shadow-lg">
          <button onClick={prevAyah} disabled={currentAyah <= 1} className="btn-ghost p-2 disabled:opacity-40">
            <SkipBack size={18} />
          </button>
          <button onClick={togglePlay} className="btn-primary p-3">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={nextAyah} disabled={currentAyah >= ayahs.length} className="btn-ghost p-2 disabled:opacity-40">
            <SkipForward size={18} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-emerald dark:text-gold-light">
              {currentAyah > 0 ? `الآية ${currentAyah} / ${ayahs.length}` : 'اضغط تشغيل للبدء'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              {audioError ? (
                <span className="flex items-center gap-1 text-red-400"><VolumeX size={12} /> {audioError}</span>
              ) : (
                <span className="flex items-center gap-1"><Volume2 size={12} /> {reciter.arabicName}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={loadAyahs} />}
      {loading ? (
        <LoadingSpinner label="جارٍ تحميل الآيات..." />
      ) : (
        <div className="card p-5">
          <p className="quran-text mb-4 text-center text-xl text-emerald dark:text-gold-light">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
          <div className="quran-text text-xl leading-loose text-slate-800 dark:text-slate-100">
            {ayahs.map((a, i) => {
              const isActive = currentAyah === i + 1;
              return (
                <span
                  key={a.verseKey}
                  id={`ayah-${i}`}
                  className={`inline-block cursor-pointer rounded-xl px-1.5 py-0.5 my-0.5 transition-all duration-300 border-2 ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-50/10 dark:border-gold dark:bg-gold/15 shadow-md ring-2 ring-emerald-500/30 dark:ring-gold/30'
                      : 'border-transparent hover:bg-emerald-50/5 dark:hover:bg-gold/5 hover:border-emerald-500/30'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVerse({ index: i, ayah: a });
                  }}
                >
                  {a.text}
                  <span
                    className={`mx-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition shadow ${
                      isActive
                        ? 'bg-gradient-to-br from-emerald to-emerald-soft text-white dark:from-gold dark:to-gold-light dark:text-emerald-deep scale-110'
                        : 'bg-emerald/10 text-emerald dark:bg-gold/20 dark:text-gold-light hover:scale-105'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playSingleAyah(i);
                    }}
                  >
                    ﴿{a.number}﴾
                  </span>{' '}
                </span>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
            اضغط على أي آية لعرض التفسير والخيارات
          </p>
        </div>
      )}

      {selectedVerse && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedVerse(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 animate-fade-in">
            <div className="card p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-emerald dark:text-gold-light">الآية {selectedVerse.ayah.number}</p>
                <button onClick={() => setSelectedVerse(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={18} />
                </button>
              </div>
              <p className="quran-text mb-4 rounded-xl bg-slate-50 dark:bg-emerald-deep/40 p-3 text-lg leading-loose text-slate-800 dark:text-slate-100">
                {selectedVerse.ayah.text}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => playSingleAyah(selectedVerse.index)}
                  className="flex flex-col items-center gap-1 rounded-xl bg-emerald/10 dark:bg-gold/10 py-3 text-xs font-semibold text-emerald dark:text-gold-light transition hover:bg-emerald/20 dark:hover:bg-gold/20"
                >
                  {playing && currentAyah === selectedVerse.index + 1 ? <Pause size={20} /> : <Play size={20} />}
                  تشغيل
                </button>
                <button
                  onClick={() => openTafsir(selectedVerse.ayah.number, selectedVerse.ayah.verseKey)}
                  className="flex flex-col items-center gap-1 rounded-xl bg-emerald/10 dark:bg-gold/10 py-3 text-xs font-semibold text-emerald dark:text-gold-light transition hover:bg-emerald/20 dark:hover:bg-gold/20"
                >
                  <BookText size={20} />
                  التفسير
                </button>
                <button
                  onClick={() => copyVerse(selectedVerse.ayah)}
                  className="flex flex-col items-center gap-1 rounded-xl bg-emerald/10 dark:bg-gold/10 py-3 text-xs font-semibold text-emerald dark:text-gold-light transition hover:bg-emerald/20 dark:hover:bg-gold/20"
                >
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                  نسخ
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <Modal open={tafsir.open} onClose={() => setTafsir((t) => ({ ...t, open: false }))} title={`تفسير الآية ${tafsir.key}`}>
        {tafsir.loading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 size={24} className="animate-spin text-emerald dark:text-gold-light" />
            <p className="text-sm text-slate-500 dark:text-slate-400">جارٍ جلب التفسير...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="quran-text rounded-xl bg-emerald/5 dark:bg-gold/10 p-3 text-lg leading-loose text-slate-800 dark:text-slate-100">
              {ayahs.find((a) => a.verseKey === tafsir.key)?.text}
            </p>
            <div className="border-t border-slate-100 dark:border-emerald-soft/30 pt-3">
              <p className="mb-2 flex items-center gap-1 text-sm font-bold text-emerald dark:text-gold-light">
                <BookText size={16} /> التفسير (الميسر):
              </p>
              <p className="text-sm leading-loose text-slate-700 dark:text-slate-200">{tafsir.text}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface KhatmaTrackerProps {
  onOpenSurah: (s: Surah) => void;
  onOpenPage: (page: number, khatmaId?: string) => void;
  surahs: Surah[];
}

function KhatmaTracker({ onOpenSurah, onOpenPage, surahs }: KhatmaTrackerProps) {
  const { khatmas: rawKhatmas, addKhatma, updateKhatmaPage, removeKhatma, addQuranPages, userId, profile, isCloudSync } = useApp();
  const khatmas = Array.isArray(rawKhatmas) ? rawKhatmas : [];
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState(10);
  const [syncFlash, setSyncFlash] = useState<string | null>(null);

  const flashSync = (label: string) => {
    setSyncFlash(label);
    setTimeout(() => setSyncFlash(null), 1200);
  };

const handleAdd = () => {
    const khatmaName = name || `ختمة ${new Date().toLocaleDateString('ar-EG')}`;
    addKhatma(khatmaName, target);
    setName('');
    setShowAdd(false);
    flashSync('تم إنشاء الختمة');
    onOpenPage(1);
  };
// ضيف الدالة دي عشان تجيب تفاصيل الآية/الصفحة الحالية
const getPageDetails = (page: number) => {
  const surah = surahs.find((s) => {
    const pages = String(s.pages).split('-').map(Number);
    return page >= pages[0] && page <= (pages[1] || pages[0]);
  });
  return surah ? `أنت في سورة ${surah.arabicName} (صفحة ${page})` : `صفحة ${page}`;
};

const surahForPage = (page: number): Surah | undefined => {
    return surahs.find((s) => {
      const pagesStr = String(s.pages || '');
      if (!pagesStr.includes('-')) {
        const p = Number(pagesStr);
        return page === p;
      }
      const [start, end] = pagesStr.split('-').map(Number);
      return page >= start && page <= (end || start);
    });
  };

  const incrementPage = (k: QuranKhatma, delta: number) => {
    const newPage = Math.max(1, Math.min(604, k.currentPage + delta));
    const actualDelta = newPage - k.currentPage;
    updateKhatmaPage(k.id, newPage);
    if (actualDelta > 0) {
      addQuranPages(actualDelta);
    }
    if (actualDelta !== 0) {
      flashSync(actualDelta > 0 ? `+${actualDelta} صفحة` : `${actualDelta} صفحة`);
    }
  };

  const completeDailyTarget = (k: QuranKhatma) => {
    const remaining = 604 - k.currentPage;
    const pages = Math.min(k.dailyTarget, remaining);
    if (pages <= 0) return;
    updateKhatmaPage(k.id, k.currentPage + pages);
    addQuranPages(pages);
    flashSync(`✓ ${pages} صفحة`);
  };

  void userId; void profile; void isCloudSync;

  return (
    <div className="space-y-3">
      {syncFlash && (
        <div className="fixed left-1/2 top-20 -translate-x-1/2 z-50 animate-fade-in">
          <div className="rounded-full bg-emerald text-white dark:bg-gold dark:text-emerald-deep px-4 py-2 text-xs font-bold shadow-lg">
            {syncFlash}
          </div>
        </div>
      )}

      <SectionCard
        title="تختيم القرآن"
        icon={<Target size={18} />}
        action={
          <div className="flex items-center gap-2">
            {!isCloudSync && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                وضع محلي
              </span>
            )}
            <button onClick={() => setShowAdd(true)} className="btn-gold px-3 py-1.5 text-xs">
              <Plus size={14} /> ختمة جديدة
            </button>
          </div>
        }
      >
        {khatmas.length === 0 ? (
          <EmptyState
            icon={<Target size={40} />}
            title="ابدأ ختمتك اليوم"
            description="حدد هدفك اليومي من الصفحات وتابع تقدمك في ختم القرآن الكريم"
            action={
              <button onClick={() => setShowAdd(true)} className="btn-primary">
                <Plus size={16} /> ابدأ ختمة
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {khatmas.map((k) => {
              const pct = Math.round((k.currentPage / k.totalPages) * 100);
              const remaining = k.totalPages - k.currentPage;
              const daysLeft = k.dailyTarget > 0 && remaining > 0 ? Math.ceil(remaining / k.dailyTarget) : 0;
              const surahNow = surahForPage(k.currentPage);
              const completed = k.currentPage >= k.totalPages;
              const dailyProgress = Math.min(100, Math.round(((k.currentPage - k.startPage) % k.dailyTarget) / k.dailyTarget * 100));
              void dailyProgress;
              return (
                <div key={k.id} className="rounded-xl bg-slate-50 dark:bg-emerald-deep/40 p-3 sm:p-4 border border-slate-100 dark:border-emerald-soft/20">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{k.name}</p>
                        {k.active && (
                          <span className="pill bg-emerald/15 text-emerald dark:bg-gold/15 dark:text-gold-light text-[10px]">
                            نشطة
                          </span>
                        )}
                        {completed && (
                          <span className="pill bg-gold/20 text-gold-dark dark:text-gold-light text-[10px]">
                            🎉 مكتملة
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        صفحة <span className="font-bold text-emerald dark:text-gold-light">{k.currentPage}</span>
                        {' / '}
                        {k.totalPages}
                        {!completed && daysLeft > 0 && (
                          <span className="mx-1">· ≈ {daysLeft} يوماً</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => { removeKhatma(k.id); flashSync('تم الحذف'); }}
                      className="text-red-400 hover:text-red-600 p-1 shrink-0 transition hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      aria-label="حذف الختمة"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="relative mb-3">
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-soft/30">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-emerald via-emerald-soft to-gold transition-all duration-700 ease-out shadow-inner"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="absolute -top-0.5 right-0 text-[10px] font-bold text-emerald dark:text-gold-light">
                      {pct}%
                    </div>
                  </div>

                  <div className="mb-3">
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => incrementPage(k, -1)}
                        disabled={k.currentPage <= 1}
                        className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-emerald-deep/60 border border-slate-200 dark:border-emerald-soft/30 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-emerald-soft/30 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="صفحة سابقة"
                        title="صفحة سابقة"
                      >
                        <ChevronRight size={16} />
                      </button>

                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-emerald-deep/60 rounded-lg px-2 h-9 border border-slate-200 dark:border-emerald-soft/30">
                        <input
                          type="number"
                          min={1}
                          max={604}
                          value={k.currentPage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) updateKhatmaPage(k.id, val);
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              const prev = k.currentPage;
                              const np = Math.max(1, Math.min(604, val));
                              if (np > prev) addQuranPages(np - prev);
                            }
                          }}
                          className="w-14 sm:w-16 text-center text-sm font-bold bg-transparent text-slate-800 dark:text-slate-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">/604</span>
                      </div>

                      <button
                        onClick={() => incrementPage(k, 1)}
                        disabled={k.currentPage >= 604}
                        className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-emerald-deep/60 border border-slate-200 dark:border-emerald-soft/30 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-emerald-soft/30 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="الصفحة التالية"
                        title="الصفحة التالية"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <button
                        onClick={() => incrementPage(k, -5)}
                        disabled={k.currentPage <= 1}
                        className="h-9 px-2 rounded-lg bg-slate-100 dark:bg-emerald-deep/60 border border-slate-200 dark:border-emerald-soft/30 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-emerald-soft/30 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="رجوع 5 صفحات"
                      >
                        -٥
                      </button>
                      <button
                        onClick={() => incrementPage(k, 5)}
                        disabled={k.currentPage >= 604}
                        className="h-9 px-2 rounded-lg bg-slate-100 dark:bg-emerald-deep/60 border border-slate-200 dark:border-emerald-soft/30 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-emerald-soft/30 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="تقدّم 5 صفحات"
                      >
                        +٥
                      </button>
                    </div>

                    <button
                      onClick={() => completeDailyTarget(k)}
                      disabled={completed || k.currentPage >= 604}
                      className="btn-primary px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={14} className="sm:mr-0.5" />
                      <span className="hidden sm:inline">قرأت الهدف اليومي </span>
                      <span className="sm:hidden">الهدف </span>
                      ({k.dailyTarget})
                    </button>
                  </div>

                  {surahNow && k.active && !completed && (
                    <button
                      onClick={() => onOpenPage(k.currentPage, k.id)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald/10 dark:bg-gold/10 py-2.5 text-xs sm:text-sm font-semibold text-emerald dark:text-gold-light hover:bg-emerald/20 dark:hover:bg-gold/20 transition active:scale-[0.99]"
                    >
                      <BookOpen size={14} /> افتح صفحة {k.currentPage}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="ختمة جديدة">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">اسم الختمة</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: ختمة رمضان"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">الهدف اليومي (صفحات)</label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 5, 10, 20, 30, 40, 60, 100].map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`rounded-xl py-2.5 text-sm font-extrabold transition active:scale-95 ${
                    target === t
                      ? 'bg-emerald text-white dark:bg-gold dark:text-emerald-deep shadow-md ring-2 ring-emerald/30 dark:ring-gold/40'
                      : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-emerald-soft/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
              ~ {604 / target | 0} يوماً للإنهاء بهذا المعدل (القرآن ٦٠٤ صفحة)
            </p>
          </div>
          <button onClick={handleAdd} className="btn-primary w-full py-3">
            <Sparkles size={16} /> ابدأ الختمة
          </button>
        </div>
      </Modal>
    </div>
  );
}
