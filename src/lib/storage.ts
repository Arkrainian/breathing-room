// localStorage can throw (private browsing, blocked site data), so every
// read and write is wrapped. The app works the same without it; you just
// lose your saved plan when the tab closes.

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable; nothing to do.
  }
}
