/**
 * MAKÉ — app.js (V9)
 *
 * Thin orchestrator.  All feature code lives in focused modules:
 *
 *   core/schema.js        — data shape, createItem, extendItem
 *   core/state.js         — reactive state store
 *   core/storage.js       — IndexedDB R/W (localStorage fallback)
 *
 *   utils/helpers.js      — esc, parseTags, relativeDate, showToast, icons
 *   utils/rich-text.js    — execCommand wrapper (isolated for migration)
 *   utils/syntax.js       — lightweight syntax highlighter (no build step)
 *   utils/drag.js         — touch+mouse drag for stickies
 *   utils/resize.js       — corner-resize for stickies
 *
 *   ui/cards.js           — background-layer card grid + link buttons
 *   ui/stickies.js        — floating sticky layer (cleanup leak fixed)
 *   ui/note-editor.js     — full-screen rich-text editor (live tag preview)
 *   ui/code-editor.js     — full-screen code editor (syntax highlighting)
 *   ui/modals.js          — link / sticky / settings / context-menu modals
 *
 *   features/ambient.js   — time-of-day sort
 *   features/data.js      — export / import (dedup on import)
 *   features/drawer.js    — side drawer (fav filter + view mode persisted)
 *   features/search.js    — full-screen search overlay
 *   features/sort-menu.js — floating sort popup
 *
 * V9 additions vs V8:
 *   – All missing ui/ files now exist (app was unrunnable without them)
 *   – Global keyboard shortcuts: Ctrl/Cmd+K = search, Ctrl/Cmd+N = new note
 *   – Settings modal exposed from bottom nav
 *   – Context menu: duplicate, favourite toggle, delete (long-press on card)
 *   – List-view mode for cards (persisted in state/prefs)
 *   – Word count in note editor
 *   – Favicon display in link buttons
 *   – Copy-to-clipboard button in code editor
 *   – Animated card deletion
 *   – Settings modal accessible from bottom nav
 */

import { state, loadInitialData }        from './core/state.js';
import { isUsingFallback }               from './core/storage.js';
import { renderCards }                   from './ui/cards.js';
import { renderStickies }                from './ui/stickies.js';
import { showNoteEditor }                from './ui/note-editor.js';
import { showCodeEditor }                from './ui/code-editor.js';
import { showLinkModal, showStickyModal, showSettingsModal } from './ui/modals.js';
import { showDrawer }                    from './features/drawer.js';
import { initAmbient }                   from './features/ambient.js';
import { showToast }                     from './utils/helpers.js';

const app = document.getElementById('app');

// ── Init ──────────────────────────────────────────────────────

async function init() {
  app.innerHTML = `
    <div class="make-loading">
      <div class="make-loading-spinner"></div>
      <span>Loading Maké…</span>
    </div>`;

  _applyTheme(_getTheme());

  await loadInitialData();

  if (isUsingFallback()) {
    console.warn('[Maké] Running on localStorage fallback — IndexedDB is unavailable.');
    showToast('Storage limited — data saved locally only', true);
  }

  app.querySelector('.make-loading')?.remove();
  _buildShell();
  renderCards();
  renderStickies();
  _attachShellListeners();
  _attachGlobalShortcuts();

  state.subscribe(() => {
    renderCards();
    renderStickies();
    _syncAddMenu();
    _syncAmbientToggle();
    _syncNavTabs();
  });

  initAmbient();
}

// ── Theme ─────────────────────────────────────────────────────

function _getTheme()  { return localStorage.getItem('make_theme') || 'light'; }
function _setTheme(t) { localStorage.setItem('make_theme', t); _applyTheme(t); }

function _applyTheme(t) {
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else              document.documentElement.removeAttribute('data-theme');
}

function _toggleTheme() {
  const next = _getTheme() === 'dark' ? 'light' : 'dark';
  _setTheme(next);
  document.getElementById('theme-toggle')?.classList.toggle('on', next === 'dark');
}

// ── Date widget ───────────────────────────────────────────────

function _getLiveDate() {
  const now  = new Date();
  const day  = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return { day, date };
}

// ── Shell ─────────────────────────────────────────────────────

function _buildShell() {
  const { day, date } = _getLiveDate();
  const isDark = _getTheme() === 'dark';

  app.innerHTML = `
    <div class="app-header">
      <div class="header-row">
        <button class="burger-btn" id="burger-btn" aria-label="Open menu">
          <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="header-right">
          <div class="date-widget" id="date-widget" aria-hidden="true">
            <div class="date-widget-date">${date}</div>
            <div class="date-widget-day">${day}</div>
          </div>
          <button class="toggle-track ${isDark ? 'on' : ''}" id="theme-toggle"
                  aria-label="Toggle theme" aria-pressed="${isDark}">
            <div class="toggle-knob"></div>
          </button>
        </div>
      </div>
      <h1 class="app-title">Maké</h1>
      <p class="app-subtitle">Your personal command center</p>
    </div>

    <div class="canvas">
      <div class="grid-layer" id="grid-layer">
        <div class="grid" id="grid-container"></div>
      </div>
      <div class="sticky-layer" id="sticky-layer"></div>
    </div>

    <div class="add-menu hidden" id="add-menu" role="menu" aria-label="Add item">
      <button data-type="note" class="add-menu-item" role="menuitem">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/></svg>
        <span>New Note</span>
      </button>
      <button data-type="code" class="add-menu-item" role="menuitem">
        <svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/></svg>
        <span>Code Snippet</span>
      </button>
      <button data-type="link" class="add-menu-item" role="menuitem">
        <svg viewBox="0 0 24 24">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        <span>Add Link</span>
      </button>
      <button data-type="sticky" class="add-menu-item" role="menuitem">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/></svg>
        <span>Sticky Note</span>
      </button>
    </div>

    <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
      <button class="nav-btn ${state.currentTab === 'links' ? 'active' : ''}"
              data-tab="links" aria-label="Links" aria-current="${state.currentTab === 'links' ? 'page' : 'false'}">
        <svg viewBox="0 0 24 24">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      </button>
      <button class="nav-btn ${state.currentTab === 'notes' ? 'active' : ''}"
              data-tab="notes" aria-label="Notes" aria-current="${state.currentTab === 'notes' ? 'page' : 'false'}">
        <svg viewBox="0 0 24 24">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      </button>
      <button class="nav-btn-fab" id="fab" aria-label="Add new item" aria-haspopup="menu">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button class="nav-btn ${state.currentTab === 'code' ? 'active' : ''}"
              data-tab="code" aria-label="Code" aria-current="${state.currentTab === 'code' ? 'page' : 'false'}">
        <svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/></svg>
      </button>
      <button class="nav-btn" id="settings-btn" aria-label="Settings">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83
                   2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33
                   1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09
                   A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06
                   a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15
                   a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09
                   A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06
                   a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68
                   a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09
                   a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06
                   a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9
                   a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09
                   a1.65 1.65 0 00-1.51 1z"/></svg>
      </button>
    </nav>
  `;
}

// ── Shell listeners ───────────────────────────────────────────

function _attachShellListeners() {
  // Tab nav + FAB + close add-menu on outside click
  app.addEventListener('click', e => {
    const tab = e.target.closest('.nav-btn[data-tab]');
    if (tab) { state.currentTab = tab.dataset.tab; return; }

    if (e.target.closest('#fab')) {
      state.showAddMenu = !state.showAddMenu;
      return;
    }

    if (state.showAddMenu &&
        !e.target.closest('#add-menu') &&
        !e.target.closest('#fab')) {
      state.showAddMenu = false;
    }
  });

  // Add-menu buttons
  document.getElementById('add-menu').addEventListener('click', e => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    state.showAddMenu = false;
    switch (btn.dataset.type) {
      case 'sticky': showStickyModal(); break;
      case 'note':   showNoteEditor();  break;
      case 'code':   showCodeEditor();  break;
      case 'link':   showLinkModal();   break;
    }
  });

  document.getElementById('theme-toggle').addEventListener('click', _toggleTheme);
  document.getElementById('burger-btn').addEventListener('click', showDrawer);
  document.getElementById('settings-btn').addEventListener('click', showSettingsModal);

  // Live date update every minute
  setInterval(() => {
    const { day, date } = _getLiveDate();
    const dw = document.getElementById('date-widget');
    if (dw) {
      dw.querySelector('.date-widget-date').textContent = date;
      dw.querySelector('.date-widget-day').textContent  = day;
    }
  }, 60_000);
}

// ── Global keyboard shortcuts ─────────────────────────────────

function _attachGlobalShortcuts() {
  document.addEventListener('keydown', async e => {
    // Don't fire if an editor / input is focused
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' ||
        document.activeElement?.isContentEditable) return;

    // Ctrl/Cmd+K — search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const { showSearch } = await import('./features/search.js');
      showSearch();
      return;
    }

    // Ctrl/Cmd+N — new note (on notes tab, otherwise respect tab)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      if      (state.currentTab === 'notes') showNoteEditor();
      else if (state.currentTab === 'code')  showCodeEditor();
      else if (state.currentTab === 'links') showLinkModal();
      return;
    }

    // Escape — close add menu if open
    if (e.key === 'Escape' && state.showAddMenu) {
      state.showAddMenu = false;
    }
  });
}

// ── State sync helpers ────────────────────────────────────────

function _syncAddMenu() {
  document.getElementById('add-menu')?.classList.toggle('hidden', !state.showAddMenu);
}

function _syncAmbientToggle() {
  document.getElementById('ambient-mini-toggle')?.classList.toggle('on', state.ambientEnabled);
}

function _syncNavTabs() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    const active = btn.dataset.tab === state.currentTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

// ── Boot ──────────────────────────────────────────────────────

init();
