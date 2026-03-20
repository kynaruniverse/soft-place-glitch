/**
 * MAKÉ UTILS — helpers.js
 * Shared pure-utility functions.  No imports, no side-effects.
 */

/** HTML-escape a string — prevents XSS when interpolating into innerHTML. */
export function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * parseTags(text)
 * Extract #hashtag tokens from plain text.
 * Returns a deduped, lower-cased array.
 */
export function parseTags(text = '') {
  return [...new Set((text.match(/#[\w]+/g) || []).map(t => t.slice(1).toLowerCase()))];
}

/** Human-readable relative timestamp. */
export function relativeDate(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000)return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * showToast(msg, isError)
 * Brief dismissing banner at the bottom of the screen.
 */
export function showToast(msg, isError = false) {
  document.getElementById('make-toast')?.remove();
  const el = document.createElement('div');
  el.id = 'make-toast';
  el.className = `toast-banner ${isError ? 'error' : 'success'}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ── Icon helpers ──────────────────────────────────────────────

export function emptyIcon(tab) {
  if (tab === 'notes') return iNote();
  if (tab === 'code')  return iCode();
  return iLink();
}

export function iNote() {
  return `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
}

export function iCode() {
  return `<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
}

export function iLink() {
  return `<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`;
}
