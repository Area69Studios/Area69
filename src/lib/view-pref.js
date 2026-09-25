const KEY = 'a69-work-view';
const VALID = ['carousel', 'grid', 'compact'];

export function readViewPref() {
  try {
    const v = localStorage.getItem(KEY);
    return VALID.includes(v) ? v : 'carousel';
  } catch {
    return 'carousel'; // private mode, corrupted value -- just the default
  }
}

export function writeViewPref(view) {
  try {
    localStorage.setItem(KEY, view);
  } catch { /* nothing to fall back to; a missed save is not worth an error */ }
}
