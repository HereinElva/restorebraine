// Clear all auth tokens on launch so user can log in fresh
try {
  Object.keys(localStorage)
    .filter(k => k.includes('base44'))
    .forEach(k => localStorage.removeItem(k));
} catch {}
