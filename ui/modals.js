/**
 * MAKÉ UI — modals.js (V1)
 * Modal factory for the four overlay types:
 *   showLinkModal     — add / edit a link card
 *   showStickyModal   — add / edit a floating sticky
 *   showSettingsModal — view mode, data export/import
 *   showContextMenu   — edit / duplicate / favourite / delete
 */

import { state, upsertItemInState, removeItemFromState } from '../core/state.js';
import { saveItem, deleteItem }  from '../core/storage.js';
import { createItem }            from '../core/schema.js';
import { esc, showToast }        from '../utils/helpers.js';

// ── Shared overlay helper ─────────────────────────────────────

/**
 * _makeOverlay(id)
 * Creates and appends a full-screen modal overlay.
 * Returns { overlay, close }.  Click outside the modal → close.
 */
function _makeOverlay(id) {
  document.getElementById(id)?.remove();

  const overlay = document.createElement('div');
  overlay.id        = id;
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 280);
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { overlay, close };
}

// ── Link Modal ────────────────────────────────────────────────

export function showLinkModal(existing = null) {
  const { overlay, close } = _makeOverlay('modal-overlay');
  overlay.setAttribute('aria-label', existing ? 'Edit link' : 'Add link');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-title">${existing ? 'Edit Link' : 'Add Link'}</div>
    <div class="modal-content">
      <input class="modal-input" id="link-url"
             type="url" placeholder="https://…"
             value="${esc(existing?.url || '')}"
             autocomplete="off" autocorrect="off">
      <input class="modal-input" id="link-title"
             type="text" placeholder="Label (optional)"
             value="${esc(existing?.title || '')}"
             autocomplete="off">
      ${existing?.url ? `
        <a class="link-preview-row" href="${esc(existing.url)}" target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span>${esc(existing.url.slice(0, 55))}${existing.url.length > 55 ? '…' : ''}</span>
        </a>` : ''}
    </div>
    <div class="modal-actions">
      ${existing ? `<button class="modal-btn danger" id="link-delete">Delete</button>` : ''}
      <button class="modal-btn" id="link-cancel">Cancel</button>
      <button class="modal-btn primary" id="link-save">Save</button>
    </div>`;
  overlay.appendChild(modal);

  const urlInput   = modal.querySelector('#link-url');
  const titleInput = modal.querySelector('#link-title');

  modal.querySelector('#link-cancel').addEventListener('click', close);

  modal.querySelector('#link-save').addEventListener('click', async () => {
    const url   = urlInput.value.trim();
    const title = titleInput.value.trim();
    if (!url) { showToast('Please enter a URL', true); urlInput.focus(); return; }
    const normalised = url.startsWith('http') ? url : `https://${url}`;
    const item = existing
      ? { ...existing, url: normalised, title: title || normalised }
      : createItem({ type: 'link', layer: 'background', url: normalised, title: title || normalised });
    try {
      const saved = await saveItem(item);
      upsertItemInState(saved);
      showToast(existing ? 'Link saved' : 'Link added');
      close();
    } catch (err) {
      console.error('[LinkModal] Save failed:', err);
      showToast('Save failed', true);
    }
  });

  modal.querySelector('#link-delete')?.addEventListener('click', async () => {
    try {
      await deleteItem(existing.id);
      removeItemFromState(existing.id);
      showToast('Link deleted');
      close();
    } catch (err) {
      console.error('[LinkModal] Delete failed:', err);
      showToast('Delete failed', true);
    }
  });

  // Enter to save, Escape to close
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement !== titleInput) {
      modal.querySelector('#link-save').click();
    }
  });

  setTimeout(() => urlInput.focus(), 300);
}

// ── Sticky Modal ──────────────────────────────────────────────

const STICKY_COLORS = [
  '#fff176', '#ffd54f', '#ffcc80',
  '#ef9a9a', '#f48fb1', '#ce93d8',
  '#80cbc4', '#a5d6a7', '#90caf9',
  '#b0bec5',
];

export function showStickyModal(existing = null) {
  const { overlay, close } = _makeOverlay('modal-overlay');
  overlay.setAttribute('aria-label', existing ? 'Edit sticky note' : 'New sticky note');

  let selectedColor = existing?.color || '#fff176';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-title">${existing ? 'Edit Sticky' : 'New Sticky'}</div>
    <div class="modal-content">
      <textarea class="modal-textarea" id="sticky-text"
                rows="4" placeholder="Write a sticky note…"
                aria-label="Sticky note text">${esc(existing?.text || '')}</textarea>
      <div class="modal-label">Colour</div>
      <div class="color-swatch-row" id="sticky-colors" role="radiogroup" aria-label="Sticky colour">
        ${STICKY_COLORS.map(c =>
          `<button class="color-swatch ${c === selectedColor ? 'selected' : ''}"
                   style="background:${c}" data-color="${c}"
                   role="radio" aria-checked="${c === selectedColor}"
                   aria-label="Colour ${c}"></button>`
        ).join('')}
      </div>
    </div>
    <div class="modal-actions">
      ${existing ? `<button class="modal-btn danger" id="sticky-delete">Delete</button>` : ''}
      <button class="modal-btn" id="sticky-cancel">Cancel</button>
      <button class="modal-btn primary" id="sticky-add">${existing ? 'Save' : 'Add Sticky'}</button>
    </div>`;
  overlay.appendChild(modal);

  // Colour swatch selection
  modal.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      selectedColor = sw.dataset.color;
      modal.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('selected', s === sw);
        s.setAttribute('aria-checked', s === sw);
      });
    });
  });

  modal.querySelector('#sticky-cancel').addEventListener('click', close);

  modal.querySelector('#sticky-add').addEventListener('click', async () => {
    const text = modal.querySelector('#sticky-text').value;
    const item = existing
      ? { ...existing, text, color: selectedColor }
      : createItem({
          type:     'sticky',
          layer:    'sticky',
          text,
          color:    selectedColor,
          rotation: +((Math.random() * 6) - 3).toFixed(1),
          position: {
            x: 20 + Math.round(Math.random() * 80),
            y: 60 + Math.round(Math.random() * 60),
            w: 188,
            h: 168,
          },
        });
    try {
      const saved = await saveItem(item);
      upsertItemInState(saved);
      showToast(existing ? 'Sticky saved' : 'Sticky added');
      close();
    } catch (err) {
      console.error('[StickyModal] Save failed:', err);
      showToast('Save failed', true);
    }
  });

  modal.querySelector('#sticky-delete')?.addEventListener('click', async () => {
    try {
      await deleteItem(existing.id);
      removeItemFromState(existing.id);
      showToast('Sticky deleted');
      close();
    } catch (err) {
      console.error('[StickyModal] Delete failed:', err);
      showToast('Delete failed', true);
    }
  });

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  setTimeout(() => modal.querySelector('#sticky-text').focus(), 300);
}

// ── Settings Modal ────────────────────────────────────────────

export function showSettingsModal() {
  const { overlay, close } = _makeOverlay('modal-overlay');
  overlay.setAttribute('aria-label', 'Settings');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-title">Settings</div>
    <div class="modal-content">
      <div class="settings-row">
        <span class="settings-label">View mode</span>
        <div class="settings-toggle-group" role="group" aria-label="View mode">
          <button class="settings-toggle-btn ${state.viewMode === 'grid' ? 'active' : ''}"
                  data-view="grid" aria-pressed="${state.viewMode === 'grid'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            Grid
          </button>
          <button class="settings-toggle-btn ${state.viewMode === 'list' ? 'active' : ''}"
                  data-view="list" aria-pressed="${state.viewMode === 'list'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            List
          </button>
        </div>
      </div>

      <div class="settings-divider"></div>
      <div class="settings-section-label">Data</div>

      <button class="settings-action-btn" id="settings-export">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export all data
      </button>

      <button class="settings-action-btn" id="settings-import">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Import backup
      </button>
    </div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="settings-close">Done</button>
    </div>`;
  overlay.appendChild(modal);

  // View mode toggle
  modal.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.viewMode = btn.dataset.view;
      modal.querySelectorAll('[data-view]').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn);
      });
    });
  });

  // Data actions
  modal.querySelector('#settings-export').addEventListener('click', async () => {
    const { exportData } = await import('../features/data.js');
    exportData();
  });
  modal.querySelector('#settings-import').addEventListener('click', async () => {
    const { importData } = await import('../features/data.js');
    importData();
  });

  modal.querySelector('#settings-close').addEventListener('click', close);
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// ── Context Menu ──────────────────────────────────────────────

export function showContextMenu(item, x, y) {
  // Remove any pre-existing context menu
  document.getElementById('ctx-overlay')?.remove();
  document.getElementById('ctx-menu')?.remove();

  const overlayEl = document.createElement('div');
  overlayEl.id        = 'ctx-overlay';
  overlayEl.className = 'context-menu-overlay';

  const menu = document.createElement('div');
  menu.id        = 'ctx-menu';
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');

  // Clamp to viewport
  const menuW = 195, menuH = 220;
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth  - menuW - 8))}px`;
  menu.style.top  = `${Math.max(8, Math.min(y, window.innerHeight - menuH - 8))}px`;

  const isLink = item.type === 'link';

  menu.innerHTML = `
    <button class="context-menu-item" data-ctx="edit" role="menuitem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit
    </button>
    ${isLink ? `
    <button class="context-menu-item" data-ctx="open" role="menuitem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      Open link
    </button>` : ''}
    <button class="context-menu-item" data-ctx="duplicate" role="menuitem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg>
      Duplicate
    </button>
    <button class="context-menu-item" data-ctx="fav" role="menuitem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      ${item.isFavorited ? 'Unfavourite' : 'Favourite'}
    </button>
    <div class="context-menu-divider" role="separator"></div>
    <button class="context-menu-item destructive" data-ctx="delete" role="menuitem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
      </svg>
      Delete
    </button>`;

  document.body.appendChild(overlayEl);
  document.body.appendChild(menu);

  const dismiss = () => { overlayEl.remove(); menu.remove(); };
  overlayEl.addEventListener('click', dismiss);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', esc); }
  });

  menu.querySelectorAll('[data-ctx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      dismiss();
      switch (btn.dataset.ctx) {

        case 'edit':
          if (item.type === 'note') {
            const { showNoteEditor } = await import('./note-editor.js');
            showNoteEditor(item);
          } else if (item.type === 'code') {
            const { showCodeEditor } = await import('./code-editor.js');
            showCodeEditor(item);
          } else if (item.type === 'link') {
            showLinkModal(item);
          } else {
            showStickyModal(item);
          }
          break;

        case 'open':
          window.open(item.url, '_blank', 'noopener,noreferrer');
          break;

        case 'duplicate': {
          const { id: _dropped, ...rest } = item;
          const dup = await saveItem({
            ...rest,
            title:     (item.title || 'Untitled') + ' (copy)',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          upsertItemInState(dup);
          showToast('Duplicated');
          break;
        }

        case 'fav': {
          const updated = await saveItem({ ...item, isFavorited: !item.isFavorited });
          upsertItemInState(updated);
          showToast(updated.isFavorited ? 'Added to favourites' : 'Removed from favourites');
          break;
        }

        case 'delete': {
          await deleteItem(item.id);
          removeItemFromState(item.id);
          showToast('Deleted');
          break;
        }
      }
    });
  });
}
