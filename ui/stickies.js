/**
 * MAKÉ UI — stickies.js (V2)
 * Floating sticky notes on the sticky layer.
 *
 * V2 fix: event listener cleanup — _dragCleanups and _resizeCleanups Maps
 * store cleanup functions that are called (via _cleanupSticky) BEFORE the
 * sticky DOM element is removed.  Without this, document-level mousemove /
 * touchmove listeners from makeDraggable / makeResizable accumulated forever.
 */

import { state, upsertItemInState, removeItemFromState } from '../core/state.js';
import { saveItem, deleteItem, updateItemPosition }       from '../core/storage.js';
import { makeDraggable }  from '../utils/drag.js';
import { makeResizable }  from '../utils/resize.js';
import { esc, showToast } from '../utils/helpers.js';

// Cleanup functions keyed by sticky id  (FIX: the V1 leak)
const _dragCleanups   = new Map(); // id → () => void
const _resizeCleanups = new Map(); // id → () => void

/** Call both cleanup fns for a sticky and remove their Map entries. */
function _cleanupSticky(id) {
  _dragCleanups.get(id)?.();
  _dragCleanups.delete(id);
  _resizeCleanups.get(id)?.();
  _resizeCleanups.delete(id);
}

// ── DOM builder ───────────────────────────────────────────────

function _buildSticky(item) {
  const el = document.createElement('div');
  el.className = 'sticky-note';
  el.dataset.id = item.id;
  el.style.setProperty('--sticky-r',     `${item.rotation || 0}deg`);
  el.style.setProperty('--sticky-color', item.color || '#fff176');

  const { x = 20 + Math.random() * 60,
          y = 70 + Math.random() * 50,
          w = 188,
          h = 168 } = item.position || {};

  el.style.left   = `${x}px`;
  el.style.top    = `${y}px`;
  el.style.width  = `${w}px`;
  el.style.height = `${h}px`;

  el.innerHTML = `
    <div class="sticky-tape"></div>
    <div class="sticky-inner">
      <div class="sticky-header">
        <button class="sticky-delete" data-del="${item.id}" aria-label="Delete sticky">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.8" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <textarea class="sticky-textarea" placeholder="Write a note…"
                spellcheck="false">${esc(item.text || '')}</textarea>
    </div>
    <div class="sticky-fold"></div>`;

  return el;
}

// ── Render ────────────────────────────────────────────────────

export function renderStickies() {
  const layer = document.getElementById('sticky-layer');
  if (!layer) return;

  const items = state.stickyItems;

  // Remove stickies no longer in state
  [...layer.querySelectorAll('.sticky-note[data-id]')].forEach(el => {
    const id = +el.dataset.id;
    if (!items.find(i => i.id === id)) {
      _cleanupSticky(id);
      el.remove();
    }
  });

  // Add newly appeared stickies (already-rendered ones are left untouched)
  items.forEach(item => {
    if (layer.querySelector(`[data-id="${item.id}"]`)) return;

    const el = _buildSticky(item);
    el.classList.add('sticky-dropped');
    layer.appendChild(el);

    // ── Drag ──────────────────────────────────────────────────
    const dragCleanup = makeDraggable(
      el,
      null, // onDrag (real-time position) — not needed
      null, // onStart
      async (finalLeft, finalTop) => {
        const pos = { ...(item.position || {}), x: finalLeft, y: finalTop };
        await updateItemPosition(item.id, pos);
        const s = state.stickyItems.find(i => i.id === item.id);
        if (s) s.position = pos; // silent local update — no full re-render
      }
    );
    _dragCleanups.set(item.id, dragCleanup);

    // ── Resize ────────────────────────────────────────────────
    const resizeCleanup = makeResizable(
      el,
      null, // onResize (real-time)
      null, // onStart
      async (finalW, finalH) => {
        const pos = { ...(item.position || {}), w: finalW, h: finalH };
        await updateItemPosition(item.id, pos);
        const s = state.stickyItems.find(i => i.id === item.id);
        if (s) s.position = pos;
      }
    );
    _resizeCleanups.set(item.id, resizeCleanup);

    // ── Textarea auto-save (debounced 600 ms) ─────────────────
    const ta = el.querySelector('.sticky-textarea');
    let saveTimer;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const s = state.stickyItems.find(i => i.id === item.id);
        if (!s) return;
        const updated = await saveItem({ ...s, text: ta.value });
        // Upsert silently — don't trigger a full stickies re-render
        const idx = state._data.stickyItems.findIndex(i => i.id === updated.id);
        if (idx >= 0) state._data.stickyItems[idx] = updated;
      }, 600);
    });

    // ── Delete ────────────────────────────────────────────────
    el.querySelector('[data-del]').addEventListener('click', async e => {
      e.stopPropagation();
      el.classList.add('sticky-deleting');
      setTimeout(async () => {
        _cleanupSticky(item.id); // FIX: remove listeners BEFORE DOM removal
        el.remove();
        await deleteItem(item.id);
        removeItemFromState(item.id);
        showToast('Sticky deleted');
      }, 210);
    });
  });
}
