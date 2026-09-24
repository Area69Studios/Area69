/* What "seen" means here: the visitor clicked through to this video on
   YouTube at least once, from this browser. Not a second-by-second
   resume position -- YouTube does not hand that number to anyone
   outside its own player, not even the account holder's own site, so
   there is nothing more precise this could ever honestly store. */
const KEY = 'a69-watched';

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set(); // private mode, corrupted value, quota -- just empty
  }
}

export function markWatched(id) {
  try {
    const set = read();
    set.add(id);
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch { /* nothing to fall back to; a missed mark is not worth an error */ }
}

export function isWatched(id) {
  return read().has(id);
}
