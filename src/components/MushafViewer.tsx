import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  SkipForward,
  Bookmark,
  BookOpen,
  Loader2,
  List,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  fetchAllAyahs,
  fetchAyahsByPage,
  juzForPage,
  surahsStartingOnPage,
  type Ayah,
  type SurahOnPage,
  TOTAL_QURAN_PAGES,
  RECITERS,
  ayahAudioUrl,
  ayahAudioFallbackUrl,
  JUZ_START_PAGES,
} from '@/services/quranService';
import type { Surah, Reciter, QuranKhatma } from '@/types';

interface MushafViewerProps {
  page: number;
  surahs: Surah[];
  khatmaId?: string | null;
  onBack: () => void;
  onPageChange?: (page: number) => void;
}

export default function MushafViewer(props: MushafViewerProps) {
  const { surahs, khatmaId, onBack, onPageChange } = props;
  const initialPage = Math.max(1, Math.min(TOTAL_QURAN_PAGES, props.page || 1));

  const { updateKhatmaPage, addQuranPages, khatmas: rawKhatmas } = useApp();
  const khatmas = Array.isArray(rawKhatmas) ? rawKhatmas : [];
  const activeKhatma: QuranKhatma | undefined = useMemo(
    () => (khatmaId ? khatmas.find((k) => k.id === khatmaId) : undefined),
    [khatmaId, khatmas],
  );

  const [page, setPage] = useState<number>(initialPage);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [allAyahs, setAllAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reciter, setReciter] = useState<Reciter>(RECITERS[0]);
  const [playing, setPlaying] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(-1);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showJumpMenu, setShowJumpMenu] = useState(false);
  const [jumpInput, setJumpInput] = useState(String(initialPage));
  const [lastRead, setLastRead] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem('tawbah:mushaf:last-page');
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const juzInfo = useMemo(() => juzForPage(page), [page]);
  const surahHeaders = useMemo<SurahOnPage[]>(
    () => (allAyahs.length > 0 ? surahsStartingOnPage(surahs, page, allAyahs) : []),
    [surahs, page, allAyahs],
  );

  const currentSurahForPage = useMemo(() => {
    return surahs.find((s) => {
      const parts = String(s.pages).split('-').map(Number);
      return page >= parts[0] && page <= (parts[1] || parts[0]);
    });
  }, [page, surahs]);

  useEffect(() => {
    try {
      localStorage.setItem('tawbah:mushaf:last-page', String(page));
    } catch {
      /* ignore */
    }
    setLastRead(page);
  }, [page]);

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        if (allAyahs.length === 0) {
          try {
            const verses = await fetchAllAyahs();
            setAllAyahs(verses);
          } catch {
            /* ignore preload failure — per-page fetch still works */
          }
        }
        const list = await fetchAyahsByPage(p);
        if (list.length === 0) throw new Error('لا توجد آيات في هذه الصفحة.');
        setAyahs(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'تعذّر تحميل الصفحة');
        setAyahs([]);
      } finally {
        setLoading(false);
      }
    },
    [allAyahs.length],
  );

  useEffect(() => {
    const next = Math.max(1, Math.min(TOTAL_QURAN_PAGES, props.page || 1));
    setPage(next);
    setJumpInput(String(next));
  }, [props.page]);

  useEffect(() => {
    stopAudio();
    setCurrentAyahIndex(-1);
    void loadPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // -------------------- Audio helpers ----------------------------------
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {
        /* ignore */
      }
    }
    setPlaying(false);
  }, []);

  const playAyah = useCallback(
    (index: number, useFallback = false) => {
      if (index < 0 || index >= ayahs.length) return;
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'auto';
      }
      const audio = audioRef.current;
      const [sid, anum] = ayahs[index].verseKey.split(':').map(Number);
      const url = useFallback
        ? ayahAudioFallbackUrl(reciter, sid, anum)
        : ayahAudioUrl(reciter.everyAyahPath, sid, anum);
      setAudioError(null);
      audio.src = url;
      audio
        .play()
        .then(() => {
          setPlaying(true);
          setCurrentAyahIndex(index);
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
    },
    [ayahs, reciter],
  );

  const togglePlay = useCallback(() => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      const start = currentAyahIndex >= 0 ? currentAyahIndex : 0;
      if (ayahs.length > 0) playAyah(start);
    }
  }, [playing, currentAyahIndex, ayahs.length, playAyah]);

  useEffect(() => {
    return () => {
      stopAudio();
      audioRef.current = null;
    };
  }, [stopAudio]);

  // -------------------- Navigation -------------------------------------
  const goto = useCallback(
    (nextPage: number) => {
      const normalized = Math.max(1, Math.min(TOTAL_QURAN_PAGES, Math.floor(nextPage)));
      if (normalized === page) return;
      setPage(normalized);
      setJumpInput(String(normalized));
      onPageChange?.(normalized);

      if (activeKhatma && normalized > activeKhatma.currentPage) {
        const delta = normalized - activeKhatma.currentPage;
        updateKhatmaPage(activeKhatma.id, normalized);
        addQuranPages(delta);
      } else if (activeKhatma && normalized < activeKhatma.currentPage) {
        updateKhatmaPage(activeKhatma.id, normalized);
      }
    },
    [page, onPageChange, activeKhatma, updateKhatmaPage, addQuranPages],
  );

  const handleJump = useCallback(() => {
    const val = parseInt(jumpInput, 10);
    if (!Number.isNaN(val)) {
      goto(val);
      setShowJumpMenu(false);
    }
  }, [jumpInput, goto]);

  const readingPct = Math.round((page / TOTAL_QURAN_PAGES) * 100);
  const currentJuz = juzInfo.juz;

  // ====================================================================
  //  RENDER
  // ====================================================================
  return (
    <div className="space-y-3 animate-fade-in pb-6">
      {/* Top Toolbar */}
      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
          <ChevronRight size={16} /> العودة
        </button>

        <div className="text-center min-w-0">
          <p className="font-quran text-lg font-extrabold text-emerald dark:text-gold-light truncate">
            {currentSurahForPage
              ? `سورة ${currentSurahForPage.arabicName}`
              : 'القرآن الكريم'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            الجزء{' '}
            <span className="font-bold text-emerald dark:text-gold-light">
              {toArabicNumeral(juzInfo.juz)}
            </span>{' '}
            · {juzInfo.arabicName}
            {khatmaId ? ' · ختمة' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 justify-center sm:justify-end">
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
            className="input max-w-[150px] py-1.5 text-sm"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.arabicName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audio Control Bar */}
      <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-2 p-3 shadow-lg">
        <button
          onClick={() => goto(page - 1)}
          disabled={page <= 1}
          className="btn-ghost p-2 disabled:opacity-40"
          title="الصفحة السابقة"
          aria-label="الصفحة السابقة"
        >
          <ChevronRight size={18} />
        </button>

        <button
          onClick={() => goto(page - 5)}
          disabled={page <= 1}
          className="btn-ghost p-2 disabled:opacity-40 hidden sm:inline-flex"
          title="رجوع ٥ صفحات"
        >
          <SkipForward size={16} className="rotate-180" />
        </button>

        <button
          onClick={togglePlay}
          className="btn-primary p-3"
          disabled={ayahs.length === 0}
          aria-label={playing ? 'إيقاف' : 'تشغيل'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          onClick={() => goto(page + 5)}
          disabled={page >= TOTAL_QURAN_PAGES}
          className="btn-ghost p-2 disabled:opacity-40 hidden sm:inline-flex"
          title="تقدّم ٥ صفحات"
        >
          <SkipForward size={16} />
        </button>

        <button
          onClick={() => goto(page + 1)}
          disabled={page >= TOTAL_QURAN_PAGES}
          className="btn-ghost p-2 disabled:opacity-40"
          title="الصفحة التالية"
          aria-label="الصفحة التالية"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold text-emerald dark:text-gold-light">
            صفحة {toArabicNumeral(page)} من {toArabicNumeral(TOTAL_QURAN_PAGES)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 min-h-[16px]">
            {audioError ? (
              <span className="flex items-center gap-1 text-red-400">
                <VolumeX size={12} /> {audioError}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Volume2 size={12} /> {reciter.arabicName}
              </span>
            )}
          </p>
        </div>

        <button
          onClick={() => setShowJumpMenu((s) => !s)}
          className="btn-ghost p-2"
          title="الانتقال السريع"
        >
          <List size={18} />
        </button>

        {lastRead && lastRead !== page && (
          <button
            onClick={() => goto(lastRead)}
            className="btn-ghost p-2"
            title="آخر صفحة مقروءة"
          >
            <Bookmark size={18} />
          </button>
        )}

        <button
          onClick={() => goto(1)}
          disabled={page === 1}
          className="btn-ghost p-2 disabled:opacity-40 hidden sm:inline-flex"
          title="بداية المصحف"
        >
          <ChevronsRight size={18} />
        </button>

        <button
          onClick={() => goto(TOTAL_QURAN_PAGES)}
          disabled={page === TOTAL_QURAN_PAGES}
          className="btn-ghost p-2 disabled:opacity-40 hidden sm:inline-flex"
          title="نهاية المصحف"
        >
          <ChevronsLeft size={18} />
        </button>
      </div>

      {/* Quick Jump Menu */}
      {showJumpMenu && (
        <div className="card p-4 animate-fade-in">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-emerald dark:text-gold-light flex items-center gap-1.5">
              <BookOpen size={16} /> الانتقال السريع
            </p>
            <button
              onClick={() => setShowJumpMenu(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              إغلاق
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={TOTAL_QURAN_PAGES}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJump();
              }}
              className="input max-w-[140px]"
              placeholder="رقم الصفحة"
            />
            <button onClick={handleJump} className="btn-primary">
              اذهب
            </button>
            <span className="text-xs text-slate-500">
              من ١ إلى {TOTAL_QURAN_PAGES}
            </span>
          </div>

          <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            الأجزاء الثلاثون (انقر للانتقال لبداية الجزء):
          </p>
          <JuzQuickButtons onSelect={goto} currentPage={page} currentJuz={currentJuz} />
        </div>
      )}

      {error && (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => loadPage(page)} className="btn-ghost text-sm">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="px-1">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-soft/30">
          <div
            className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-gold via-emerald-soft to-emerald transition-all duration-700 ease-out shadow-inner"
            style={{ width: `${readingPct}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          تقدم القراءة: {readingPct}% · صفحة {toArabicNumeral(page)}
        </p>
      </div>

      {/* Mushaf Page Frame */}
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <Loader2 size={32} className="animate-spin text-emerald dark:text-gold-light" />
          <p className="text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الصفحة…</p>
        </div>
      ) : (
        <MushafPageFrame page={page} juz={juzInfo.juz}>
          {surahHeaders.map((h) => (
            <SurahHeaderBanner key={h.surahId} surah={h} />
          ))}

          {surahHeaders.some((h) => h.surahId !== 1 && h.surahId !== 9) && (
            <p className="quran-text my-4 text-center text-xl font-bold text-emerald-700 dark:text-gold-light">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
          )}

          <div
            className="quran-text text-right text-[22px] leading-[2.3] sm:text-[24px] sm:leading-[2.5] text-slate-900 dark:text-slate-100"
            dir="rtl"
          >
            {ayahs.map((a, i) => {
              const isActive = currentAyahIndex === i;
              return (
                <span
                  key={a.verseKey}
                  className={`cursor-pointer transition-all duration-300 rounded-lg px-1 inline ${
                    isActive
                      ? 'bg-amber-200/60 text-emerald-900 ring-2 ring-gold shadow-sm dark:bg-gold/20 dark:text-gold-light dark:ring-gold-light'
                      : 'hover:bg-emerald-50/40 dark:hover:bg-gold/10'
                  }`}
                  onClick={() => {
                    if (playing && currentAyahIndex === i) {
                      audioRef.current?.pause();
                      setPlaying(false);
                    } else {
                      playAyah(i);
                    }
                  }}
                  title={`آية ${a.number} · ${a.verseKey}`}
                >
                  {a.text}
                  <AyahMarker number={a.number} highlighted={isActive} />
                </span>
              );
            })}
          </div>
        </MushafPageFrame>
      )}

      {/* Bottom Navigation */}
      <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
        <button
          onClick={() => goto(page - 1)}
          disabled={page <= 1}
          className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-40"
        >
          <ChevronRight size={16} /> صفحة سابقة
        </button>

        <button
          onClick={() => {
            setShowJumpMenu(true);
            setTimeout(() => {
              document.getElementById('jump-top')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }, 50);
          }}
          id="jump-top"
          className="btn-gold px-4 py-2.5 text-sm hidden sm:inline-flex"
        >
          <BookOpen size={14} /> قائمة الأجزاء
        </button>

        <button
          onClick={() => goto(page + 1)}
          disabled={page >= TOTAL_QURAN_PAGES}
          className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-40"
        >
          صفحة تالية <ChevronLeft size={16} />
        </button>
      </div>

      {activeKhatma && (
        <div className="mt-2 card border-gold/40 bg-gold/5 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <p className="font-bold text-gold-dark dark:text-gold-light">
              ختمة: {activeKhatma.name}
            </p>
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              {Math.round((activeKhatma.currentPage / activeKhatma.totalPages) * 100)}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-soft/30">
            <div
              className="h-full rounded-full bg-gradient-to-l from-emerald via-emerald-soft to-gold"
              style={{
                width: `${Math.min(
                  100,
                  (activeKhatma.currentPage / activeKhatma.totalPages) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Arabic numerals ٠١٢٣٤٥٦٧٨٩
// ==========================================================================
function toArabicNumeral(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).replace(/\d/g, (d) => map[Number(d)]);
}

// ==========================================================================
// Decorative Mushaf Frame (Islamic double border + corners)
// ==========================================================================
function MushafPageFrame({
  page,
  juz,
  children,
}: {
  page: number;
  juz: number;
  children: React.ReactNode;
}) {
  const isRightPage = page % 2 === 1; // traditional orientation
  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl">
      <div
        className={`relative border-[3px] border-double border-gold/70 bg-white shadow-2xl dark:border-gold-light/60 dark:bg-[#0b2a22] ${
          isRightPage ? '' : ''
        }`}
      >
        <div className="m-2 border-2 border-gold/50 dark:border-gold-light/40 rounded-xl relative">
          <MushafCorners />

          <div className="relative px-5 py-6 sm:px-10 sm:py-10">{children}</div>

          <div className="relative border-t border-gold/40 dark:border-gold-light/30 py-3 text-center">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                الجزء {toArabicNumeral(juz)}
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-light px-4 py-1 text-sm font-bold text-white shadow-md dark:from-gold dark:to-gold-dark dark:text-emerald-deep">
                ﴿ {toArabicNumeral(page)} ﴾
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {isRightPage ? 'صَفْحَة يُمَاء' : 'صَفْحَة يَسَار'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MushafCorners() {
  const base =
    'absolute pointer-events-none h-8 w-8 text-gold/75 dark:text-gold-light/65';
  return (
    <>
      <CornerSvg className={`${base} top-2 right-2`} />
      <CornerSvg className={`${base} top-2 left-2 -scale-x-100`} />
      <CornerSvg className={`${base} bottom-2 right-2 -scale-y-100`} />
      <CornerSvg className={`${base} bottom-2 left-2 scale-x-[-1] scale-y-[-1]`} />
    </>
  );
}

function CornerSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path
        d="M2 2 L16 2 M2 2 L2 16 M2 2 Q 14 14 2 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M2 2 L10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 3"
      />
      <circle cx="2" cy="2" r="2.4" fill="currentColor" />
    </svg>
  );
}

// ==========================================================================
// Surah decorative header banner
// ==========================================================================
function SurahHeaderBanner({ surah }: { surah: SurahOnPage }) {
  const place = surah.revelationPlace === 'makkah' ? 'مكية' : 'مدنية';
  return (
    <div className="relative mx-auto mb-5 max-w-md">
      <div className="flex items-center">
        <span className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-gold/70 dark:to-gold-light/60" />
        <div className="mx-3 flex items-center gap-3 rounded-full border-2 border-gold/70 bg-gradient-to-br from-white via-gold/5 to-gold/15 px-5 py-2 shadow-inner dark:border-gold-light/60 dark:from-[#0b2a22] dark:via-[#0c3428] dark:to-gold/10">
          <StarIcon className="h-5 w-5 text-gold dark:text-gold-light" />
          <div className="text-center">
            <p className="font-quran text-xl font-extrabold text-emerald-800 dark:text-gold-light">
              سورة {surah.arabicName}
            </p>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">
              {surah.englishName} · {place}
            </p>
          </div>
          <StarIcon className="h-5 w-5 text-gold dark:text-gold-light -scale-x-100" />
        </div>
        <span className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-gold/70 dark:to-gold-light/60" />
      </div>
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M12 2.5 l2.6 5.9 l6.3.6 -4.7 4.3 1.4 6.2 L12 16.9 6.4 19.5 l1.4-6.2 L3.1 9 l6.3-.6 z"
      />
    </svg>
  );
}

// ==========================================================================
// Decorative Ayah Marker (traditional flower-shaped ١٢٣)
// ==========================================================================
function AyahMarker({ number, highlighted }: { number: number; highlighted?: boolean }) {
  return (
    <span
      className={`mx-1.5 inline-flex h-[1.6em] w-[1.6em] translate-y-[-1px] items-center justify-center rounded-full text-[12px] font-bold align-middle transition-all ${
        highlighted
          ? 'bg-gradient-to-br from-emerald to-emerald-deep text-white shadow-md dark:from-gold dark:to-gold-dark dark:text-emerald-deep ring-2 ring-white/80 dark:ring-emerald-deep scale-110'
          : 'bg-emerald/15 text-emerald-800 ring-1 ring-emerald/30 dark:bg-gold/20 dark:text-gold-light dark:ring-gold/45'
      }`}
      title={`آية ${number}`}
    >
      {toArabicNumeral(number)}
    </span>
  );
}

// ==========================================================================
// 30 Juz quick button grid
// ==========================================================================
function JuzQuickButtons({
  onSelect,
  currentPage,
  currentJuz,
}: {
  onSelect: (page: number) => void;
  currentPage: number;
  currentJuz: number;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-10">
      {JUZ_START_PAGES.map((j) => {
        const active = currentJuz === j.juz;
        return (
          <button
            key={j.juz}
            onClick={() => onSelect(j.page)}
            title={`الجزء ${j.juz} · ${j.arabicName}`}
            className={`group relative rounded-xl px-2 py-2 text-xs font-extrabold transition active:scale-95 ${
              active
                ? 'bg-gradient-to-br from-emerald to-emerald-deep text-white shadow-md dark:from-gold dark:to-gold-dark dark:text-emerald-deep'
                : 'bg-slate-100 text-slate-700 hover:bg-emerald/10 hover:text-emerald-800 dark:bg-emerald-soft/30 dark:text-slate-200 dark:hover:bg-gold/15 dark:hover:text-gold-light'
            }`}
          >
            <span>{toArabicNumeral(j.juz)}</span>
            <span className="mt-0.5 block truncate text-[9px] font-semibold opacity-80">
              {j.arabicName}
            </span>
            <span className="block text-[9px] opacity-70">صفحة {toArabicNumeral(j.page)}</span>
            {currentPage === j.page && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-white dark:ring-emerald-deep" />
            )}
          </button>
        );
      })}
    </div>
  );
}
