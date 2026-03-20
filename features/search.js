/**
 * MAKÉ FEATURES — search.js
 * Full-screen search overlay with type + time filters.
 */

import { state }      from '../core/state.js';
import { esc }        from '../utils/helpers.js';

export function showSearch() {
  if (document.getElementById('search-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'search-overlay';
  overlay.className = 'search-overlay';
  overlay.innerHTML = `
    <div class="search-bar">
      <button class="search-cancel-btn" id="search-cancel">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <input id="search-input" type="text" placeholder="Search…" autocomplete="off">
    </div>
    <div class="search-filter-chips">
      <button class="search-filter-chip" data-type="note">Notes</button>
      <button class="search-filter-chip" data-type="code">Code</button>
      <button class="search-filter-chip" data-type="link">Links</button>
      <button class="search-filter-chip" data-time="86400000">Today</button>
      <button class="search-filter-chip" data-time="604800000">This week</button>
    </div>
    <div class="search-results" id="search-results">
      <div class="search-hint">Start typing to search…</div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const input = overlay.querySelector('#search-input');
  setTimeout(() => input.focus(), 350);

  let activeType = null;
  let activeTime = null;

  function run() {
    const q   = input.value.trim().toLowerCase();
    const now = Date.now();
    let res   = state.backgroundItems;

    if (activeType) res = res.filter(i => i.type === activeType);
    if (activeTime) res = res.filter(i => (i.createdAt || 0) >= now - activeTime);
    if (q) {
      res = res.filter(i =>
        (i.title   || '').toLowerCase().includes(q) ||
        (i.content || '').replace(/<[^>]*>/g, '').toLowerCase().includes(q) ||
        (i.code    || '').toLowerCase().includes(q) ||
        (i.url     || '').toLowerCase().includes(q) ||
        (i.tags    || []).some(t => t.toLowerCase().includes(q))
      );
    }

    const el = document.getElementById('search-results');
    if (!el) return;

    if (!q && !activeType && !activeTime) {
      el.innerHTML = '<div class="search-hint">Start typing…</div>';
      return;
    }
    if (!res.length) {
      el.innerHTML = '<div class="search-empty-msg">No results</div>';
      return;
    }

    el.innerHTML = res.map(item => `
      <div class="card search-result-card" data-id="${item.id}" style="min-height:auto">
        <div class="card-header">
          <span class="card-type-label">${item.type}: ${esc(item.title || 'Untitled')}</span>
        </div>
        <div class="card-content">
          ${esc((item.content || item.code || item.url || '').replace(/<[^>]*>/g, '').slice(0, 120))}
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.card[data-id]').forEach(card => {
      card.addEventListener('click', async () => {
        const item = state.backgroundItems.find(i => i.id === +card.dataset.id);
        if (!item) return;
        _closeSearch(overlay);
        if (item.type === 'note') {
          const m = await import('./note-editor.js').catch(
            () => import('../ui/note-editor.js')
          );
          m.showNoteEditor(item);
        } else if (item.type === 'code') {
          const m = await import('../ui/code-editor.js');
          m.showCodeEditor(item);
        } else {
          const m = await import('../ui/modals.js');
          m.showLinkModal(item);
        }
      });
    });
  }

  input.addEventListener('input', run);

  overlay.querySelectorAll('.search-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      if (chip.dataset.type) {
        overlay.querySelectorAll('.search-filter-chip[data-type]').forEach(c => {
          if (c !== chip) c.classList.remove('active');
        });
        activeType = chip.classList.contains('active') ? chip.dataset.type : null;
      } else {
        overlay.querySelectorAll('.search-filter-chip[data-time]').forEach(c => {
          if (c !== chip) c.classList.remove('active');
        });
        activeTime = chip.classList.contains('active') ? +chip.dataset.time : null;
      }
      run();
    });
  });

  document.getElementById('search-cancel').addEventListener('click', () => _closeSearch(overlay));
}

function _closeSearch(overlay) {
  overlay.classList.remove('open');
  setTimeout(() => overlay.remove(), 350);
}
