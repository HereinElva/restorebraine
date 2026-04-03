/**
 * persistentStorage.js
 *
 * A drop-in replacement for localStorage that uses Capacitor's Preferences
 * plugin when running as a native app. This survives app closes and relaunches.
 *
 * Falls back to localStorage automatically when running in a browser.
 */

// Detect if we're running inside Capacitor
const isCapacitor = () => {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
};

// Lazily import Capacitor Preferences so the web build doesn't break
let _Preferences = null;
async function getPreferences() {
  if (_Preferences) return _Preferences;
  try {
    const mod = await import('@capacitor/preferences');
    _Preferences = mod.Preferences;
    return _Preferences;
  } catch {
    return null;
  }
}

export const persistentStorage = {
  /**
   * Get a value by key. Returns null if not found.
   */
  async get(key) {
    if (isCapacitor()) {
      const Preferences = await getPreferences();
      if (Preferences) {
        const { value } = await Preferences.get({ key });
        return value ?? null;
      }
    }
    // Fallback to localStorage
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Set a value by key.
   */
  async set(key, value) {
    if (isCapacitor()) {
      const Preferences = await getPreferences();
      if (Preferences) {
        await Preferences.set({ key, value: String(value) });
        return;
      }
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },

  /**
   * Remove a value by key.
   */
  async remove(key) {
    if (isCapacitor()) {
      const Preferences = await getPreferences();
      if (Preferences) {
        await Preferences.remove({ key });
        return;
      }
    }
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },

  /**
   * Synchronous get — for code that can't use async (uses localStorage only).
   * In Capacitor this will return the last value written via set(),
   * which we mirror into localStorage so it's always available synchronously.
   */
  getSync(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Mirror a value into localStorage so getSync() works.
   * Called automatically by set().
   */
  _mirror(key, value) {
    try {
      if (value == null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch {}
  },
};

// Override set to also mirror into localStorage for sync access
const _originalSet = persistentStorage.set.bind(persistentStorage);
persistentStorage.set = async (key, value) => {
  persistentStorage._mirror(key, value);
  await _originalSet(key, value);
};

const _originalRemove = persistentStorage.remove.bind(persistentStorage);
persistentStorage.remove = async (key) => {
  persistentStorage._mirror(key, null);
  await _originalRemove(key);
};
