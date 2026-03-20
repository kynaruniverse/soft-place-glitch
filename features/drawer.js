/**
 * MAKÉ FEATURES — drawer.js
 * Slide-in left-side drawer: ambient toggle, favourites, sort, search,
 * export, import.
 *
 * FIX: The favourites toggle now uses state.filterFavourites (proper setter)
 * instead of mutating state._data directly.
 */

import { state }          from '../core/state.js';
import { startAmbient, stopAmbient } from './ambient.js';

export function showDrawer() {
  if (document.getElementById('drawer')) return;

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = 'drawer-overlay';

  const drawer = document.createElement('div');
  drawer.className = 'drawer opening';
  drawer.id = 'drawer';

  drawer.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-title">Maké</div>
      <div class="drawer-subtitle">Your personal command center</div>
    </div>
    <div class="drawer-body">
      <div class="drawer-section-label">Organise</div>

      <div class="drawer-toggle-row" id="ambient-row">
        <span class="drawer-toggle-label">🌙 Ambient sorting</span>
        <button class="mini-toggle ${state.ambientEnabled ? 'on' : ''}"
                id="ambient-mini-toggle" aria-label="Ambient sorting">
          <div class="mini-toggle-knob"></div>
        </button>
      </div>

      <div class="drawer-toggle-row">
        <span class="drawer-toggle-label">⭐ Favourites only</span>
        <button class="mini-toggle ${state.filterFavourites ? 'on' : ''}"
                id="fav-toggle" aria-label="Favourites only">
          <div class="mini-toggle-knob"></div>
        </button>
      </div>

      <div class="drawer-divider"></div>
      <div class="drawer-section-label">Actions</div>

      <button class="drawer-item" id="drawer-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span class="drawer-item-label">Search</span>
      </button>

      <button class="drawer-item" id="drawer-sort">
        <svg viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
        <span class="drawer-item-label">Sort: ${_sortLabel()}</span>
      </button>

      <div class="drawer-divider"></div>
      <div class="drawer-section-label">Data</div>

      <button class="drawer-item" id="drawer-export">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span class="drawer-item-label">Export data</span>
      </button>

      <button class="drawer-item" id="drawer-import">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span class="drawer-item-label">Import data</span>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  const close = () => {
    drawer.classList.remove('opening');
    drawer.classList.add('closing');
    overlay.style.animation = 'fade-in 200ms ease reverse both';
    setTimeout(() => { drawer.remove(); overlay.remove(); }, 250);
  };

  overlay.addEventListener('click', close);

  // Ambient toggle.
  document.getElementById('ambient-mini-toggle').addEventListener('click', e => {
    e.stopPropagation();
    state.ambientEnabled = !state.ambientEnabled;
    e.currentTarget.classList.toggle('on', state.ambientEnabled);
    state.ambientEnabled ? startAmbient() : stopAmbient();
  });

  // FIX: use state.filterFavourites setter so the value is persisted.
  document.getElementById('fav-toggle').addEventListener('click', e => {
    e.stopPropagation();
    state.filterFavourites = !state.filterFavourites;   // ← goes through setter, saves to prefs
    e.currentTarget.classList.toggle('on', state.filterFavourites);
  });

  document.getElementById('drawer-search').addEventListener('click', () => {
    close();
    setTimeout(async () => {
      const m = await import('./search.js');
      m.showSearch();
    }, 300);
  });

  document.getElementById('drawer-sort').addEventListener('click', () => {
    close();
    setTimeout(async () => {
      const r = (document.getElementById('burger-btn') || document.body).getBoundingClientRect();
      const m = await import('./sort-menu.js');
      m.showSortMenuAt(r.right - 190, r.bottom + 8);
    }, 300);
  });

  document.getElementById('drawer-export').addEventListener('click', () => {
    close();
    setTimeout(async () => {
      const m = await import('./data.js');
      m.exportData();
    }, 300);
  });

  document.getElementById('drawer-import').addEventListener('click', () => {
    close();
    setTimeout(async () => {
      const m = await import('./data.js');
      m.importData();
    }, 300);
  });
}

function _sortLabel() {
  const map = { updatedAt: 'Modified', createdAt: 'Created', title: 'Title' };
  return (map[state.sortField] || 'Modified') + (state.sortDir === 'asc' ? ' ↑' : ' ↓');
}
