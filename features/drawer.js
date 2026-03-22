/**
 * MAKÉ FEATURES — drawer.js (V15)
 *
 * V15 improvements:
 *   – Focus management: focus moves to first item on open, restored on close
 *   – Full focus trap: Tab/Shift+Tab cycle within drawer
 *   – Escape closes and restores focus to burger button
 */

import { state }                     from '../core/state.js';
import { startAmbient, stopAmbient } from './ambient.js';

export function showDrawer() {
  if (document.getElementById('drawer')) return;

  const prevFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id        = 'drawer-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const drawer = document.createElement('div');
  drawer.className = 'drawer opening';
  drawer.id        = 'drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Menu');

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
                id="ambient-mini-toggle"
                aria-label="Ambient sorting"
                aria-pressed="${state.ambientEnabled}">
          <div class="mini-toggle-knob"></div>
        </button>
      </div>

      <div class="drawer-toggle-row">
        <span class="drawer-toggle-label">⭐ Favourites only</span>
        <button class="mini-toggle ${state.filterFavourites ? 'on' : ''}"
                id="fav-toggle"
                aria-label="Favourites only"
                aria-pressed="${state.filterFavourites}">
          <div class="mini-toggle-knob"></div>
        </button>
      </div>

      <div class="drawer-divider"></div>
      <div class="drawer-section-label">View</div>

      <div class="drawer-view-row" role="group" aria-label="View mode">
        <button class="drawer-view-btn ${state.viewMode === 'grid' ? 'active' : ''}"
                data-view="grid" aria-pressed="${state.viewMode === 'grid'}">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          Grid
        </button>
        <button class="drawer-view-btn ${state.viewMode === 'list' ? 'active' : ''}"
                data-view="list" aria-pressed="${state.viewMode === 'list'}">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          List
        </button>
      </div>

      <div class="drawer-divider"></div>
      <div class="drawer-section-label">Actions</div>

      <button class="drawer-item" id="drawer-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span class="drawer-item-label">Search</span>
        <span class="drawer-shortcut">⌘K</span>
      </button>

      <button class="drawer-item" id="drawer-sort">
        <svg viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
        <span class="drawer-item-label">Sort: ${_sortLabel()}</span>
      </button>

      <div class="drawer-divider"></div>
      <div class="drawer-section-label">Data</div>

      <button class="drawer-item" id="drawer-export">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span class="drawer-item-label">Export backup</span>
      </button>

      <button class="drawer-item" id="drawer-import">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span class="drawer-item-label">Restore from backup</span>
      </button>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  // Move focus into drawer
  setTimeout(() => drawer.querySelector('button')?.focus(), 300);

  // ── Focus trap ────────────────────────────────────────────────
  const SEL = 'button:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const trapKey = e => {
    if (e.key !== 'Tab') return;
    const els = [...drawer.querySelectorAll(SEL)];
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  };
  drawer.addEventListener('keydown', trapKey);

  const close = () => {
    drawer.removeEventListener('keydown', trapKey);
    drawer.classList.remove('opening');
    drawer.classList.add('closing');
    overlay.style.animation = 'fade-in 200ms ease reverse both';
    setTimeout(() => {
      drawer.remove();
      overlay.remove();
      prevFocus?.focus();
    }, 260);
  };

  overlay.addEventListener('click', close);

  // ── Escape closes ─────────────────────────────────────────────
  const _onKey = e => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _onKey); }
  };
  document.addEventListener('keydown', _onKey);

  // ── Ambient toggle ────────────────────────────────────────────
  document.getElementById('ambient-mini-toggle').addEventListener('click', e => {
    e.stopPropagation();
    state.ambientEnabled = !state.ambientEnabled;
    e.currentTarget.classList.toggle('on', state.ambientEnabled);
    e.currentTarget.setAttribute('aria-pressed', state.ambientEnabled);
    state.ambientEnabled ? startAmbient() : stopAmbient();
  });

  // ── Favourites toggle ─────────────────────────────────────────
  document.getElementById('fav-toggle').addEventListener('click', e => {
    e.stopPropagation();
    state.filterFavourites = !state.filterFavourites;
    e.currentTarget.classList.toggle('on', state.filterFavourites);
    e.currentTarget.setAttribute('aria-pressed', state.filterFavourites);
  });

  // ── View mode ─────────────────────────────────────────────────
  drawer.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.viewMode = btn.dataset.view;
      drawer.querySelectorAll('[data-view]').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn);
      });
    });
  });

  // ── Search ────────────────────────────────────────────────────
  document.getElementById('drawer-search').addEventListener('click', () => {
    close();
    setTimeout(async () => {
      const { showSearch } = await import('./search.js');
      showSearch();
    }, 300);
  });

  // ── Sort ──────────────────────────────────────────────────────
  document.getElementById('drawer-sort').addEventListener('click', () => {
    close();
    setTimeout(async () => {
      const burgerEl = document.getElementById('burger-btn') || document.getElementById('canvas-toolbar') || document.body;
      const r = burgerEl.getBoundingClientRect();
      const { showSortMenuAt } = await import('./sort-menu.js');
      showSortMenuAt(r.left, r.bottom + 8);
    }, 300);
  });

  // ── Export / Import ───────────────────────────────────────────
  document.getElementById('drawer-export').addEventListener('click', () => {
    close();
    setTimeout(async () => { const { exportData } = await import('./data.js'); exportData(); }, 300);
  });
  document.getElementById('drawer-import').addEventListener('click', () => {
    close();
    setTimeout(async () => { const { importData } = await import('./data.js'); importData(); }, 300);
  });
}

function _sortLabel() {
  const map = { updatedAt: 'Modified', createdAt: 'Created', title: 'Title' };
  return (map[state.sortField] || 'Modified') + (state.sortDir === 'asc' ? ' ↑' : ' ↓');
}
