/** Wait until Capacitor native plugins are callable (bridge can be late on cold start). */
export function waitForCapacitorBridge(timeoutMs = 8000) {
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const started = Date.now();

    const ready = () => {
      try {
        if (!window.Capacitor?.isNativePlatform?.()) return true;
        return Boolean(window.Capacitor?.Plugins?.App || window.Capacitor?.Plugins?.Preferences);
      } catch {
        return false;
      }
    };

    if (ready()) {
      resolve(true);
      return;
    }

    const tick = () => {
      if (ready()) {
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        console.warn('Capacitor bridge not ready before timeout — continuing with localStorage fallbacks');
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };

    tick();
  });
}

export function withTimeout(promise, timeoutMs, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}
