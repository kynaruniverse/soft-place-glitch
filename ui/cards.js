/**
 * MAKÉ UI — cards.js (V1)
 * Background-layer card grid + link button grid.
 *
 * Responsibilities:
 *   – Filter items by currentTab, filterFavourites
 *   – Sort by sortField / sortDir
 *   – Render note/code cards (grid or list view) and link buttons
 *   – Wire click → editor/modal, long-press → context menu, fav toggle
 */

import { state, upsertItemInState } from '../core/state.js';
import { saveItem }                  from '../core/storage.js';
import { esc, relativeDate, showToast, emptyIcon, iNote, iCode, iLink } from '../utils/helpers.js';

// ── Filtering & sorting ───────────────────────────────────────

function _filtered() {
  const tab = state.currentTab;
  let items = state.backgroundItems.filter(i =>
    (tab === 'notes' && i.type === 'note') ||
    (tab === 'code'  && i.type === 'code') ||
    (tab === 'links' && i.type === 'link')
  );
  if (state.filterFavourites) items = items.filter(i => i.isFavorited);
  const { sortField: sf, sortDir: sd } = state;
  return [...items].sort((a, b) => {
    let va = a[sf] ?? 0, vb = b[sf] ?? 0;
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return sd === 'asc'
      ? (va < vb ? -1 : va > vb ?  1 : 0)
      : (va > vb ? -1 : va < vb ?  1 : 0);
  });
}

// ── Type icon helper ──────────────────────────────────────────

function _typeIcon(type) {
  if (type === 'note') return iNote();
  if (type === 'code') return iCode();
  return iLink();
}

// ── Card HTML ─────────────────────────────────────────────────

function _cardHTML(item) {
  const preview = item.type === 'note'
    ? (item.content || '').replace(/<[^>]+>/g, '')
    : item.type === 'code'
      ? (item.code || '')
      : (item.url || '');
  const tags = (item.tags || []).slice(0, 5);
  return `
    <div class="card-header">
      <span class="card-type-badge">${_typeIcon(item.type)}</span>
      <span class="card-type-label">${esc(item.title || 'Untitled')}</span>
      <button class="card-fav ${item.isFavorited ? 'active' : ''}"
              data-fav="${item.id}" aria-label="${item.isFavorited ? 'Unfavourite' : 'Favourite'}">
        <svg viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
    </div>
    <div class="card-content">${item.type === 'note' ? (item.content || '') : esc(preview)}</div>
    ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="card-meta">
      <span class="card-meta-time">${relativeDate(item.updatedAt)}</span>
    </div>`;
}

// ── Link button HTML ──────────────────────────────────────────

function _linkBtnHTML(item) {
  let domain = '';
  try { domain = new URL(item.url).hostname; } catch { /* ignore */ }
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';
  const label = esc(item.title || domain || 'Link');

  return `
    <a class="link-btn" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"
       data-id="${item.id}" data-type="link-btn">
      <div class="link-btn-icon">
        ${faviconUrl
          ? `<img src="${faviconUrl}" width="28" height="28" alt=""
                  style="border-radius:6px;object-fit:contain"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <svg viewBox="0 0 24 24" style="${faviconUrl ? 'display:none' : ''}">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
        </svg>
      </div>
      <span class="link-btn-label">${label}</span>
    </a>`;
}

// ── Main render ───────────────────────────────────────────────

export function renderCards() {
  const container = document.getElementById('grid-container');
  if (!container) return;

  const items   = _filtered();
  const isLinks = state.currentTab === 'links';
  const isList  = state.viewMode === 'list';

  if (isLinks) {
    _renderLinks(container, items);
    return;
  }

  container.className = isList ? 'list-grid' : 'grid';

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${emptyIcon(state.currentTab)}</div>
        <div class="empty-title">No ${state.currentTab} yet</div>
        <div class="empty-hint">Tap <strong>+</strong> to create one</div>
      </div>`;
    return;
  }

  container.innerHTML = items.map((item, i) =>
    `<div class="card card-animate-in" data-id="${item.id}" style="animation-delay:${i * 28}ms">
       ${_cardHTML(item)}
     </div>`
  ).join('');

  _wireCardEvents(container);
}

function _renderLinks(container, items) {
  container.className = 'links-grid';

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${iLink()}</div>
        <div class="empty-title">No links yet</div>
        <div class="empty-hint">Tap <strong>+</strong> to add a link</div>
      </div>`;
    return;
  }

  container.innerHTML = items.map(i => _linkBtnHTML(i)).join('');

  // Right-click / long-press → context menu (prevent navigation)
  container.querySelectorAll('.link-btn[data-id]').forEach(btn => {
    let pressTimer;
    const id = +btn.dataset.id;

    btn.addEventListener('contextmenu', e => {
      e.preventDefault();
      _showCtx(id, e.clientX, e.clientY);
    });
    btn.addEventListener('pointerdown', e => {
      pressTimer = setTimeout(() => {
        e.preventDefault();
        btn.blur(); // prevent navigation
        _showCtx(id, e.clientX, e.clientY);
      }, 500);
    });
    btn.addEventListener('pointerup',   () => clearTimeout(pressTimer));
    btn.addEventListener('pointermove', () => clearTimeout(pressTimer));
  });
}

function _wireCardEvents(container) {
  // Card click → open editor
  container.querySelectorAll('.card[data-id]').forEach(card => {
    let pressTimer;
    const id = +card.dataset.id;

    card.addEventListener('click', async e => {
      if (e.target.closest('[data-fav]')) return;
      clearTimeout(pressTimer);
      const item = state.backgroundItems.find(i => i.id === id);
      if (item) await _openItem(item);
    });

    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      _showCtx(id, e.clientX, e.clientY);
    });
    card.addEventListener('pointerdown', e => {
      pressTimer = setTimeout(() => _showCtx(id, e.clientX, e.clientY), 500);
    });
    card.addEventListener('pointerup',   () => clearTimeout(pressTimer));
    card.addEventListener('pointermove', () => clearTimeout(pressTimer));
  });

  // Favourite toggle
  container.querySelectorAll('[data-fav]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id   = +btn.dataset.fav;
      const item = state.backgroundItems.find(i => i.id === id);
      if (!item) return;
      const updated = await saveItem({ ...item, isFavorited: !item.isFavorited });
      upsertItemInState(updated);
    });
  });
}

// ── Lazy loaders ──────────────────────────────────────────────

async function _openItem(item) {
  if (item.type === 'note') {
    const { showNoteEditor } = await import('./note-editor.js');
    showNoteEditor(item);
  } else if (item.type === 'code') {
    const { showCodeEditor } = await import('./code-editor.js');
    showCodeEditor(item);
  } else {
    const { showLinkModal } = await import('./modals.js');
    showLinkModal(item);
  }
}

async function _showCtx(id, x, y) {
  const item = [...state.backgroundItems, ...state.stickyItems].find(i => i.id === id);
  if (!item) return;
  const { showContextMenu } = await import('./modals.js');
  showContextMenu(item, x, y);
}
