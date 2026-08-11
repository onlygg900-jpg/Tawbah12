const PREFIX = 'tawbah:';

export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? (parsed as unknown as T) : fallback;
    }
    if (
      fallback &&
      typeof fallback === 'object' &&
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return { ...fallback, ...parsed } as T;
    }
    return (parsed as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function removeState(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return localDateKey();
}

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}
