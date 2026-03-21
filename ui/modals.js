/**
 * MAKÉ UI — modals.js
 * Modal factory, link modal, sticky modal, settings modal, context menu.
 */

import { state, upsertItemInState, removeItemFromState } from '../core/state.js';
import { saveItem, deleteItem }                           from '../core/storage.js';
import { createItem, ItemType, ItemLayer }                from '../core/schema.js';
import { esc, showToast }                                 from '../utils/helpers.js';
import { STICKY_COLORS }                                  from './stickies.js';

// ── Modal factory ─────────────────────────────────────────────

/**
 * openModal({ title, fields, actions, onReady })
 * Renders a centred sheet modal and returns { overlay, close }.
 *
 * fields[] types: 'input' | 'textarea' | 'select' | 'swatches'
 * actions[] shape: { id, label, primary?, danger? }
 */
export function openModal({ title, fields, actions, onReady }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  const fieldHTML = fields.map(f => {
    if (f.type === 'input')
      return `<input id="${f.id}" class="modal-input" placeholder="${f.placeholder || ''}" value="${esc(f.value || '')}">`;
    if (f.type === 'textarea')
      return `<textarea id="${f.id}" class="modal-textarea" placeholder="${f.placeholder || ''}" rows="${f.rows || 6}">${esc(f.value || '')}</textarea>`;
    if (f.type === 'select')
      return `<select id="${f.id}" class="modal-select">
        ${f.options.map(o => `<option value="${o.value}" ${o.value === f.value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>`;
    if (f.type === 'swatches')
      return `<div class="color-swatch-row">
        ${STICKY_COLORS.map(c =>
          `<button class="color-swatch ${c === f.value ? 'selected' : ''}" style="background:${c}" data-color="${c}"></button>`
        ).join('')}
      </div>`;
    return '';
  }).join('');

  overlay.innerHTML = `
    <div class="modal">
      <h3 class="modal-title">${title}</h3>
      <div class="modal-content">${fieldHTML}</div>
      <div class="modal-actions">
        ${actions.map(a =>
          `<button id="${a.id}" class="modal-btn ${a.primary ? 'primary' : a.danger ? 'danger' : ''}">${a.label}</button>`
        ).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 220);
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  if (onReady) onReady(overlay, close);

  return { overlay, close };
}

// ── Link modal ────────────────────────────────────────────────

export function showLinkModal(existingItem = null) {
  openModal({
    title: existingItem ? 'Edit Link' : 'Add Link',
    fields: [
      { type: 'input', id: 'f-url',   placeholder: 'https://…',       value: existingItem?.url   || '' },
      { type: 'input', id: 'f-title', placeholder: 'Label (optional)', value: existingItem?.title || '' },
    ],
    actions: existingItem
      ? [{ id: 'm-delete', label: 'Delete', danger: true }, { id: 'm-cancel', label: 'Cancel' }, { id: 'm-save', label: 'Save', primary: true }]
      : [{ id: 'm-cancel', label: 'Cancel' }, { id: 'm-save', label: 'Save', primary: true }],
    onReady: (overlay, close) => {
      overlay.querySelector('#m-cancel').addEventListener('click', close);

      overlay.querySelector('#m-delete')?.addEventListener('click', async () => {
        await deleteItem(existingItem.id);
        removeItemFromState(existingItem.id);
        close();
      });

      overlay.querySelector('#m-save').addEventListener('click', async () => {
        const url   = overlay.querySelector('#f-url')?.value.trim()   || '';
        const title = overlay.querySelector('#f-title')?.value.trim() || '';
        if (!url) { showToast('URL is required', true); return; }
        let saved;
        if (existingItem) {
          saved = await saveItem({ ...existingItem, url, title });
        } else {
          saved = await saveItem(createItem({
            layer: ItemLayer.BACKGROUND, type: ItemType.LINK, url, title,
          }));
        }
        upsertItemInState(saved);
        showToast(existingItem ? 'Link updated' : 'Link saved');
        close();
      });
    },
  });
}

// ── Sticky modal ──────────────────────────────────────────────

export function showStickyModal() {
  let col = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
  openModal({
    title: 'New Sticky',
    fields: [
      { type: 'textarea', id: 'f-text',  placeholder: 'Write something…', rows: 4 },
      { type: 'swatches', id: 'f-color', value: col },
    ],
    actions: [
      { id: 'm-cancel', label: 'Cancel' },
      { id: 'm-save',   label: 'Add Sticky', primary: true },
    ],
    onReady: (overlay, close) => {
      overlay.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
          sw.classList.add('selected');
          col = sw.dataset.color;
        });
      });

      overlay.querySelector('#m-cancel').addEventListener('click', close);

      overlay.querySelector('#m-save').addEventListener('click', async () => {
        const text = overlay.querySelector('#f-text')?.value || '';
        const item = createItem({
          layer:    ItemLayer.STICKY,
          type:     ItemType.STICKY,
          text,
          color:    col,
          rotation: parseFloat((Math.random() * 8 - 4).toFixed(1)),
          position: { x: 50 + Math.random() * 120, y: 30 + Math.random() * 100, width: 175, height: 150 },
        });
        upsertItemInState(await saveItem(item));
        close();
      });
    },
  });
}

// ── Settings modal ────────────────────────────────────────────

export async function showSettingsModal() {
  const { exportData, importData } = _lazyDataModule();

  // Grab storage info before rendering
  const { getPersistenceState, getStorageEstimate } = await import('../core/storage.js');
  const persistState = getPersistenceState();
  const estimate     = await getStorageEstimate();

  const persistIcon  = persistState === 'granted'     ? '🔒'
                     : persistState === 'denied'       ? '⚠️'
                     : persistState === 'unsupported'  ? 'ℹ️'
                     : '⏳';
  const persistLabel = persistState === 'granted'     ? 'Protected — safe from browser clear'
                     : persistState === 'denied'       ? 'Not protected — install as app for safety'
                     : persistState === 'unsupported'  ? 'Browser doesn\'t support persistence'
                     : 'Checking…';
  const persistCls   = persistState === 'granted' ? 'persist-ok' : persistState === 'denied' ? 'persist-warn' : 'persist-info';

  const storageRow = estimate
    ? `<div class="storage-usage-bar-wrap">
         <div class="storage-usage-bar" style="width:${Math.min(estimate.percent,100)}%"></div>
       </div>
       <div class="storage-usage-label">${estimate.usageStr} used of ${estimate.quotaStr}</div>`
    : '';

  openModal({
    title: 'Settings',
    fields: [],
    actions: [
      { id: 's-export', label: '↓ Export backup' },
      { id: 's-import', label: '↑ Import backup' },
      { id: 's-close',  label: 'Done', primary: true },
    ],
    onReady: (overlay, close) => {
      // Inject storage status above the actions
      const actionsEl = overlay.querySelector('.modal-actions');
      const statusEl  = document.createElement('div');
      statusEl.className = 'storage-status-block';
      statusEl.innerHTML = `
        <div class="storage-status-row ${persistCls}">
          <span class="storage-status-icon">${persistIcon}</span>
          <div class="storage-status-text">
            <div class="storage-status-title">Data protection</div>
            <div class="storage-status-detail">${persistLabel}</div>
          </div>
        </div>
        ${storageRow}
        <div class="storage-status-hint">
          Your notes are stored <strong>only on this device</strong>.<br>
          Use Export to save a backup file you can restore anytime.
        </div>`;
      actionsEl.parentNode.insertBefore(statusEl, actionsEl);

      overlay.querySelector('#s-close').addEventListener('click', close);
      overlay.querySelector('#s-export').addEventListener('click', () => { exportData(); close(); });
      overlay.querySelector('#s-import').addEventListener('click', () => { importData(); close(); });
    },
  });
}

// ── Context menu ──────────────────────────────────────────────

export function showContextMenu(evt, item) {
  document.getElementById('ctx-overlay')?.remove();
  document.getElementById('ctx-menu')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ctx-overlay';
  overlay.className = 'context-menu-overlay';

  const menu = document.createElement('div');
  menu.id = 'ctx-menu';
  menu.className = 'context-menu';

  menu.innerHTML = [
    { label: item.isFavorited ? '♡ Unfavorite' : '♡ Favorite', action: 'favorite'   },
    { label: '⎘ Duplicate',                                      action: 'duplicate'  },
    { label: '✎ Edit',                                           action: 'edit'       },
    { divider: true },
    { label: '⌦ Delete',                                         action: 'delete', destructive: true },
  ].map(a => a.divider
    ? `<div class="context-menu-divider"></div>`
    : `<button class="context-menu-item ${a.destructive ? 'destructive' : ''}" data-action="${a.action}">${a.label}</button>`
  ).join('');

  const x = evt.clientX ?? window.innerWidth  / 2;
  const y = evt.clientY ?? window.innerHeight / 2;
  menu.style.left = `${Math.min(x, window.innerWidth  - 200)}px`;
  menu.style.top  = `${Math.min(y, window.innerHeight - 200)}px`;

  document.body.appendChild(overlay);
  document.body.appendChild(menu);

  const dismiss = () => { overlay.remove(); menu.remove(); };
  overlay.addEventListener('click', dismiss);

  menu.querySelectorAll('.context-menu-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      dismiss();
      const action = btn.dataset.action;

      if (action === 'edit') {
        if (item.type === 'note') {
          const m = await import('./note-editor.js');
          m.showNoteEditor(item);
        } else if (item.type === 'code') {
          const m = await import('./code-editor.js');
          m.showCodeEditor(item);
        } else {
          showLinkModal(item);
        }

      } else if (action === 'favorite') {
        item.isFavorited = !item.isFavorited;
        upsertItemInState(await saveItem(item));

      } else if (action === 'duplicate') {
        const dup = createItem({
          ...item,
          id:        undefined,
          title:     (item.title || 'Untitled') + ' copy',
          createdAt: undefined,
        });
        upsertItemInState(await saveItem(dup));
        showToast('Duplicated');

      } else if (action === 'delete') {
        await deleteItem(item.id);
        removeItemFromState(item.id);
      }
    });
  });
}

// ── Lazy import helper ────────────────────────────────────────

function _lazyDataModule() {
  let _mod = null;
  const load = () => { if (!_mod) _mod = import('../features/data.js'); return _mod; };
  return {
    exportData: async () => { const m = await load(); m.exportData(); },
    importData: async () => { const m = await load(); m.importData(); },
  };
}
