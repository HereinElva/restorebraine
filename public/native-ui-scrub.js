/** Runs before React — strips debug badge, stale loading UI, and "Sign in instead". */
(function () {
  function scrub() {
    try {
      var stamp = document.getElementById('rb-native-stamp');
      if (stamp) stamp.remove();
      document.querySelectorAll('[id*="native-stamp"], [class*="native-stamp"]').forEach(function (n) {
        n.remove();
      });
      document.querySelectorAll('button, a, p, span').forEach(function (el) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^sign in instead$/i.test(text)) el.remove();
        if (/^v\d+\s*ⓘ$/i.test(text) || /^v\d+\s*i$/i.test(text)) {
          var parent = el.closest('#rb-native-stamp') || el;
          if (parent.id === 'rb-native-stamp' || /native-stamp/i.test(parent.id || '')) parent.remove();
        }
      });
    } catch (e) {}
  }
  scrub();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrub);
  }
  if (!window.__rbNativeUiScrubber) {
    window.__rbNativeUiScrubber = new MutationObserver(scrub);
    window.__rbNativeUiScrubber.observe(document.documentElement, { childList: true, subtree: true });
  }
  setInterval(scrub, 500);
  window.__restorebraineScrubLegacyUi = scrub;
})();
