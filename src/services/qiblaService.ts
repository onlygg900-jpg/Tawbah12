// Qibla direction calculation (bearing to Kaaba from current location)
// Kaaba coordinates: 21.4225° N, 39.8262° E

const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function qiblaBearing(lat: number, lng: number): number {
  const phiK = toRad(KAABA_LAT);
  const lambdaK = toRad(KAABA_LNG);
  const phi = toRad(lat);
  const lambda = toRad(lng);

  const y = Math.sin(lambdaK - lambda);
  const x =
    Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda);
  let bearing = toDeg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;
  return bearing;
}

export function distanceToKaaba(lat: number, lng: number): number {
  const R = 6371; // km
  const dLat = toRad(KAABA_LAT - lat);
  const dLng = toRad(KAABA_LNG - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(KAABA_LAT)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function getDeviceHeading(event: DeviceOrientationEvent): number | null {
  // webkitCompassHeading for iOS (Apple), alpha for Android
  const anyEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (typeof anyEvent.webkitCompassHeading === 'number') {
    return anyEvent.webkitCompassHeading;
  }
  if (event.alpha != null) {
    return 360 - event.alpha;
  }
  return null;
}

export async function requestGeolocation(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

export async function requestOrientationPermission(): Promise<boolean> {
  const anyDO = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof anyDO.requestPermission === 'function') {
    try {
      const res = await anyDO.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}
