import { useEffect, useState, useRef } from 'react';
import { Navigation, Crosshair, MapPin, ArrowLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SectionCard, LoadingSpinner } from '@/components/ui';
import type { ViewKey } from '@/types';
import {
  qiblaBearing,
  distanceToKaaba,
  getDeviceHeading,
  requestGeolocation,
  requestOrientationPermission,
} from '@/services/qiblaService';

interface Props {
  onChange?: (v: ViewKey) => void;
}

export default function QiblaView({ onChange }: Props) {
  const { settings } = useApp();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const compassRef = useRef<HTMLDivElement>(null);

  const locate = async () => {
    setLocating(true);
    setPermError(null);
    const pos = await requestGeolocation();
    if (!pos) {
      setPermError('تعذّر تحديد موقعك. تحقق من إذن الموقع.');
      setLocating(false);
      return;
    }
    setLocation(pos);
    const b = qiblaBearing(pos.lat, pos.lng);
    setBearing(b);
    setDistance(distanceToKaaba(pos.lat, pos.lng));
    setLocating(false);
    const ok = await requestOrientationPermission();
    if (!ok) setPermError('تعذّر الوصول إلى مستشعر الاتجاه على الأجهزة المدعومة.');
  };

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const h = getDeviceHeading(e);
      if (h != null) setHeading(h);
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  const needleAngle = bearing != null ? bearing - heading : 0;
  const aligned = Math.abs(((needleAngle % 360) + 360) % 360) < 8;

  return (
    <div className="space-y-4 p-4 pb-24 animate-fade-in">
      <div className="flex items-center gap-3">
        {onChange && (
          <button
            onClick={() => onChange('home')}
            className="btn-ghost !p-2"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-extrabold text-emerald dark:text-gold-light">اتجاه القبلة</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">وجه وجهك نحو الكعبة المشرّفة</p>
        </div>
      </div>

      <div className="card p-5 bg-gradient-to-br from-emerald/5 via-white to-gold/5 dark:from-emerald-soft/20 dark:via-emerald-deep/60 dark:to-gold/10">
        {locating ? (
          <LoadingSpinner label="جارٍ تحديد موقعك بدقة..." />
        ) : permError && !location ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-5xl">📍</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xs mx-auto">{permError}</p>
            <button onClick={locate} className="btn-primary">
              <Crosshair size={18} /> إعادة المحاولة
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 py-3">
            <div ref={compassRef} className="relative h-64 w-64 sm:h-72 sm:w-72">
              <div
                className="absolute inset-0 rounded-full border-8 border-emerald/20 dark:border-emerald-soft/30 bg-white/60 dark:bg-emerald-deep/50 shadow-2xl"
                style={{ transform: `rotate(${-heading}deg)`, transition: 'transform 0.12s linear' }}
              >
                {['N', 'E', 'S', 'W'].map((d, i) => (
                  <span
                    key={d}
                    className={`absolute font-extrabold text-lg ${
                      d === 'N' ? 'text-red-500' : 'text-emerald/70 dark:text-gold-light/70'
                    }`}
                    style={{
                      top: d === 'N' ? '8px' : d === 'S' ? 'calc(100% - 28px)' : '50%',
                      left: d === 'W' ? '8px' : d === 'E' ? 'calc(100% - 24px)' : '50%',
                      transform: `translate(-50%, -50%) rotate(${heading}deg)`,
                    }}
                  >
                    {d === 'N' ? 'شمال' : d === 'S' ? 'جنوب' : d === 'E' ? 'شرق' : 'غرب'}
                  </span>
                ))}
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`absolute left-1/2 top-1 ${i % 9 === 0 ? 'h-3 w-0.5 bg-emerald/70 dark:bg-gold-light/70' : 'h-1.5 w-px bg-emerald/30 dark:bg-gold-light/30'}`}
                    style={{ transformOrigin: '50% 128px', transform: `rotate(${i * 10}deg)` }}
                  />
                ))}
              </div>

              <div
                className="absolute inset-0 transition-transform duration-200"
                style={{ transform: `rotate(${needleAngle}deg)` }}
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
                  <div className={`h-24 w-2 rounded-full shadow-xl ${aligned ? 'bg-gold' : 'bg-emerald'}`} />
                  <div className={`-mt-1 h-0 w-0 border-x-6 border-b-8 border-x-transparent ${aligned ? 'border-b-gold' : 'border-b-emerald'}`} />
                </div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[170px] text-3xl filter drop-shadow-lg">
                  🕋
                </div>
              </div>

              <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald dark:bg-gold-light shadow-xl ring-4 ring-white/80 dark:ring-emerald-deep" />
            </div>

            {aligned ? (
              <div className="pill bg-gold/20 text-gold-dark dark:text-gold-light animate-scale-in text-base px-4 py-2 font-bold">
                ✨ أنت تواجه القبلة الآن - قم بالصلاة ✨
              </div>
            ) : (
              <p className="pill bg-emerald/10 dark:bg-gold/10 text-emerald dark:text-gold-light px-4 py-1.5">
                <Navigation size={16} /> قم بتحريك الهاتف حتى يصطف السهم مع الكعبة
              </p>
            )}

            <div className="grid grid-cols-3 gap-3 w-full max-w-md mt-2">
              <div className="card p-3 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">زاوية القبلة</p>
                <p className="text-xl font-extrabold text-emerald dark:text-gold-light mt-1">
                  {bearing != null ? `${Math.round(bearing)}°` : '—'}
                </p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">المسافة</p>
                <p className="text-xl font-extrabold text-emerald dark:text-gold-light mt-1">
                  {distance != null ? `${Math.round(distance)}` : '—'}
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">كم</span>
                </p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">اتجاهك</p>
                <p className="text-xl font-extrabold text-emerald dark:text-gold-light mt-1">
                  {Math.round(((heading % 360) + 360) % 360)}°
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
              <MapPin size={14} /> 
              <span className="font-semibold">{settings.city}</span>
              {location && <span className="opacity-70">— {location.lat.toFixed(3)}, {location.lng.toFixed(3)}</span>}
            </div>

            <div className="flex gap-2">
              <button onClick={locate} className="btn-primary">
                <Crosshair size={16} /> إعادة المعايرة
              </button>
            </div>
          </div>
        )}
      </div>

      <SectionCard title="نصائح لضبط الاتجاه" icon={<Navigation size={18} />}>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 pr-5 list-disc">
          <li>أبعد الهاتف عن أي أجهزة إلكترونية أو معدنية لتجنب تشويش البوصلة.</li>
          <li>حرّك الهاتف بحركة رقم ثمانية (8) لمعايرة المستشعر عند الحاجة.</li>
          <li>في الأماكن المغلقة، قد تحتاج إلى الاقتراب من النافذة لتحديد الموقع بدقة.</li>
          <li>يُحسب الاتجاه بناءً على خطوط الطول والعرض الحالي للموقع.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
