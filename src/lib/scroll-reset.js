export function resetAppScrollPosition() {
  if (typeof window === 'undefined') return;
  const main = document.getElementById('rb-app-scroll');
  const targets = [main, document.documentElement, document.body, document.getElementById('root')].filter(Boolean);
  targets.forEach((el) => {
    try {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    } catch {
      /* ignore */
    }
  });
  try {
    window.scrollTo(0, 0);
  } catch {
    /* ignore */
  }
}
