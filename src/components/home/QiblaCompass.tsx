import { useEffect, useState, useRef } from 'react';
import { Navigation, Crosshair, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SectionCard, LoadingSpinner } from '@/components/ui';
import {
  qiblaBearing,
  distanceToKaaba,
  getDeviceHeading,
  requestGeolocation,
  requestOrientationPermission,
} from '@/services/qiblaService';

export default function QiblaCompass() {
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
    if (!ok) setPermError('تعذّر الوصول إلى مستشعر الاتجاه.');
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

  // The needle angle: we want the Qibla marker to point toward bearing relative to current heading
  const needleAngle = bearing != null ? bearing - heading : 0;
  const aligned = Math.abs(((needleAngle % 360) + 360) % 360) < 5;

  return (
    <SectionCard title="اتجاه القبلة" icon={<Navigation size={18} />}>
      {locating ? (
        <LoadingSpinner label="جارٍ تحديد موقعك..." />
      ) : permError && !location ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{permError}</p>
          <button onClick={locate} className="btn-ghost">
            <Crosshair size={16} /> إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <div ref={compassRef} className="relative h-44 w-44">
            {/* Compass dial (rotates with heading) */}
            <div
              className="absolute inset-0 rounded-full border-4 border-emerald/20 dark:border-emerald-soft/30 bg-white/50 dark:bg-emerald-deep/40"
              style={{ transform: `rotate(${-heading}deg)`, transition: 'transform 0.1s linear' }}
            >
              {/* cardinal points */}
              {['N', 'E', 'S', 'W'].map((d, i) => (
                <span
                  key={d}
                  className={`absolute text-xs font-bold ${
                    d === 'N' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                  }`}
                  style={{
                    top: d === 'N' ? '4px' : d === 'S' ? 'calc(100% - 16px)' : '50%',
                    left: d === 'W' ? '4px' : d === 'E' ? 'calc(100% - 12px)' : '50%',
                    transform: `translate(-50%, -50%) rotate(${heading}deg)`,
                  }}
                >
                  {d === 'N' ? 'ش' : d === 'S' ? 'ج' : d === 'E' ? 'ق' : 'غ'}
                </span>
              ))}
              {/* tick marks */}
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-1/2 top-1 h-2 w-px bg-emerald/30"
                  style={{ transformOrigin: '50% 84px', transform: `rotate(${i * 15}deg)` }}
                />
              ))}
            </div>

            {/* Qibla needle (fixed rotation = bearing - heading) */}
            <div
              className="absolute inset-0 transition-transform duration-150"
              style={{ transform: `rotate(${needleAngle}deg)` }}
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
                <div className={`h-16 w-1 rounded-full ${aligned ? 'bg-gold' : 'bg-emerald'} shadow-lg`} />
                <div className={`-mt-1 h-0 w-0 border-x-4 border-b-4 border-x-transparent ${aligned ? 'border-b-gold' : 'border-b-emerald'}`} />
              </div>
              {/* Kaaba icon at tip */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[140px] text-xl">
                🕋
              </div>
            </div>

            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald dark:bg-gold-light" />
          </div>

          {aligned && (
            <p className="pill bg-gold/20 text-gold-dark dark:text-gold-light animate-scale-in">
              أنت تواجه القبلة الآن
            </p>
          )}

          <div className="flex items-center gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">زاوية القبلة</p>
              <p className="text-lg font-bold text-emerald dark:text-gold-light">
                {bearing != null ? `${Math.round(bearing)}°` : '—'}
              </p>
            </div>
            {distance != null && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">المسافة للكعبة</p>
                <p className="text-lg font-bold text-emerald dark:text-gold-light">
                  {distance.toLocaleString('ar-EG')} كم
                </p>
              </div>
            )}
          </div>

          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <MapPin size={12} /> {settings.city} — {location ? `${location.lat.toFixed(2)}, ${location.lng.toFixed(2)}` : '...'}
          </p>
          <button onClick={locate} className="btn-ghost text-xs">
            <Crosshair size={14} /> معايرة
          </button>
        </div>
      )}
    </SectionCard>
  );
}
