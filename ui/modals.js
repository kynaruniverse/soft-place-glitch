/**
 * MAKÉ UI — modals.js (V15)
 *
 * V15 improvements:
 *   – openModal: focus moves into modal on open, restored to trigger on close
 *   – showContextMenu: auto-flips position when near viewport edges
 *   – showContextMenu (sticky): colour picker row added inline
 *   – showSettingsModal: focus trapped inside, restored on close
 *   – Save/delete buttons guard against double-tap (disabled state)
 *   – ARIA roles added throughout
 */

import { state, upsertItemInState, removeItemFromState } from '../core/state.js';
import { saveItem, deleteItem }                           from '../core/storage.js';
import { createItem, ItemType, ItemLayer }                from '../core/schema.js';
import { esc, showToast }                                 from '../utils/helpers.js';
import { STICKY_COLORS }                                  from './stickies.js';

// ── Focus trap utility ────────────────────────────────────────

function _focusTrap(container) {
  const SEL = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const getFocusable = () => [...container.querySelectorAll(SEL)];
  const onKey = e => {
    if (e.key !== 'Tab') return;
    const els = getFocusable();
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

// ── Modal factory ─────────────────────────────────────────────

export function openModal({ title, fields, actions, onReady }) {
  const prevFocus = document.activeElement;

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
      return `<div class="color-swatch-row" role="group" aria-label="Colour">
        ${STICKY_COLORS.map(c =>
          `<button class="color-swatch ${c === f.value ? 'selected' : ''}" style="background:${c}" data-color="${c}" aria-label="Colour ${c}"></button>`
        ).join('')}
      </div>`;
    return '';
  }).join('');

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
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

  setTimeout(() => overlay.querySelector('input, textarea, button.primary, button')?.focus(), 240);

  const modal = overlay.querySelector('.modal');
  const removeTrap = _focusTrap(modal);

  const close = () => {
    removeTrap();
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); prevFocus?.focus(); }, 220);
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

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
        const btn = overlay.querySelector('#m-delete');
        if (btn.disabled) return;
        btn.disabled = true;
        await deleteItem(existingItem.id);
        removeItemFromState(existingItem.id);
        close();
      });

      overlay.querySelector('#m-save').addEventListener('click', async () => {
        const saveBtn = overlay.querySelector('#m-save');
        if (saveBtn.disabled) return;
        const url   = overlay.querySelector('#f-url')?.value.trim()   || '';
        const title = overlay.querySelector('#f-title')?.value.trim() || '';
        if (!url) { showToast('URL is required', true); return; }
        saveBtn.disabled = true;
        saveBtn.classList.add('loading');
        const normalised = url.startsWith('http') ? url : `https://${url}`;
        try {
          let saved;
          if (existingItem) {
            saved = await saveItem({ ...existingItem, url: normalised, title });
          } else {
            saved = await saveItem(createItem({ layer: ItemLayer.BACKGROUND, type: ItemType.LINK, url: normalised, title }));
          }
          upsertItemInState(saved);
          window._makeAutoBackup?.();
          showToast(existingItem ? 'Link updated' : 'Link saved');
          close();
        } catch {
          showToast('Save failed — try again', true);
          saveBtn.disabled = false;
          saveBtn.classList.remove('loading');
        }
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
        const saveBtn = overlay.querySelector('#m-save');
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        const text = overlay.querySelector('#f-text')?.value || '';
        const item = createItem({
          layer: ItemLayer.STICKY, type: ItemType.STICKY, text, color: col,
          rotation: parseFloat((Math.random() * 8 - 4).toFixed(1)),
          position: { x: 50 + Math.random() * 120, y: 30 + Math.random() * 100, width: 175, height: 150 },
        });
        upsertItemInState(await saveItem(item));
        window._makeAutoBackup?.();
        close();
      });
    },
  });
}

// ── Settings — full-page slide-up panel ───────────────────────

export async function showSettingsModal() {
  if (document.getElementById('settings-page')) return;
  const prevFocus = document.activeElement;

  const { getPersistenceState, getStorageEstimate } = await import('../core/storage.js');
  const { exportData, importData } = _lazyDataModule();

  const persistState = getPersistenceState();
  const estimate     = await getStorageEstimate();
  const isDark       = localStorage.getItem('make_theme') === 'dark';
  const isGrid       = state.viewMode !== 'list';
  const isAmbient    = state.ambientEnabled;

  const storageIcon   = persistState === 'granted' ? '🔒' : persistState === 'denied' ? '⚠️' : 'ℹ️';
  const storageTitle  = persistState === 'granted' ? 'Data protected'
                      : persistState === 'denied'  ? 'Not fully protected' : 'Checking…';
  const storageDetail = persistState === 'granted'
    ? 'Safe from browser clear. Only uninstalling the app removes your data.'
    : persistState === 'denied'
      ? 'Install as a home screen app for full protection against browser clears.'
      : 'Checking storage persistence status…';
  const detailClass = persistState === 'granted' ? 'green' : persistState === 'denied' ? 'amber' : 'muted';

  const usageWarning = estimate?.percent > 80
    ? `<div class="settings-storage-note" style="color:#e8a86a;margin-top:4px">⚠️ Storage nearly full — export a backup soon.</div>` : '';

  const usageBar = estimate ? `
    <div class="settings-storage-divider"></div>
    <div class="settings-usage-wrap">
      <div class="settings-usage-row">
        <div class="settings-usage-bar-bg">
          <div class="settings-usage-bar-fill" style="width:${Math.min(estimate.percent,100)}%"></div>
        </div>
        <span class="settings-usage-label">${estimate.usageStr} / ${estimate.quotaStr}</span>
      </div>
      ${usageWarning}
      <div class="settings-storage-note">Your data lives only on this device and is never sent anywhere.</div>
    </div>` : '';

  const page = document.createElement('div');
  page.id = 'settings-page';
  page.className = 'settings-page';
  page.setAttribute('role', 'dialog');
  page.setAttribute('aria-modal', 'true');
  page.setAttribute('aria-label', 'Settings');

  page.innerHTML = `
    <div class="settings-topbar">
      <button class="settings-back-btn" id="settings-back" aria-label="Close settings">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <span class="settings-topbar-title">Settings</span>
    </div>
    <div class="settings-body">
      <div class="settings-group">
        <div class="settings-group-label">Appearance</div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-left">
            <span class="settings-toggle-icon" id="sp-theme-icon">${isDark ? '🌙' : '☀️'}</span>
            <div><div class="settings-toggle-label">Dark mode</div><div class="settings-toggle-desc">Switch between light and dark theme</div></div>
          </div>
          <button class="mini-toggle ${isDark ? 'on' : ''}" id="sp-theme-toggle" aria-label="Dark mode" aria-pressed="${isDark}">
            <div class="mini-toggle-knob"></div>
          </button>
        </div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-left">
            <span class="settings-toggle-icon">🗂️</span>
            <div><div class="settings-toggle-label">Card view</div><div class="settings-toggle-desc">Choose how notes are displayed</div></div>
          </div>
          <div class="settings-segmented" role="group" aria-label="View mode">
            <button class="settings-seg-btn ${isGrid ? 'active' : ''}" id="sp-view-grid" aria-pressed="${isGrid}">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Grid
            </button>
            <button class="settings-seg-btn ${!isGrid ? 'active' : ''}" id="sp-view-list" aria-pressed="${!isGrid}">
              <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>List
            </button>
          </div>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-label">Organisation</div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-left">
            <span class="settings-toggle-icon">🌙</span>
            <div><div class="settings-toggle-label">Ambient sorting</div><div class="settings-toggle-desc">Morning = notes · Afternoon = links · Evening = code</div></div>
          </div>
          <button class="mini-toggle ${isAmbient ? 'on' : ''}" id="sp-ambient-toggle" aria-label="Ambient sorting" aria-pressed="${isAmbient}">
            <div class="mini-toggle-knob"></div>
          </button>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-label">How your data is saved</div>
        <div class="settings-explainer">
          <div class="settings-explainer-row">
            <span class="settings-explainer-icon">💾</span>
            <div class="settings-explainer-text">
              <div class="settings-explainer-title">Saves automatically inside the app</div>
              <div class="settings-explainer-body">Every note, link, snippet and sticky saves the moment you tap Save. Close the app, reopen it — everything is there.</div>
            </div>
          </div>
          <div class="settings-explainer-divider"></div>
          <div class="settings-explainer-row">
            <span class="settings-explainer-icon">🗂️</span>
            <div class="settings-explainer-text">
              <div class="settings-explainer-title">Backup file is extra insurance</div>
              <div class="settings-explainer-body">The export file is a safety net — not the main save. Your notes are already safe inside the app.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-label">Storage status</div>
        <div class="settings-storage-card">
          <div class="settings-storage-status">
            <span class="settings-storage-icon">${storageIcon}</span>
            <div class="settings-storage-text">
              <div class="settings-storage-title">${storageTitle}</div>
              <div class="settings-storage-detail ${detailClass}">${storageDetail}</div>
            </div>
          </div>
          ${usageBar}
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-label">Backup &amp; restore</div>
        <button class="settings-action" id="sp-export">
          <span class="settings-action-icon">📤</span>
          <div class="settings-action-text"><div class="settings-action-title">Export backup</div><div class="settings-action-desc">Save all your data as a file you keep</div></div>
          <span class="settings-action-chevron">›</span>
        </button>
        <button class="settings-action" id="sp-import">
          <span class="settings-action-icon">📥</span>
          <div class="settings-action-text"><div class="settings-action-title">Restore from backup</div><div class="settings-action-desc">Import a previously exported file</div></div>
          <span class="settings-action-chevron">›</span>
        </button>
      </div>
      <div class="settings-group">
        <div class="settings-group-label">Help</div>
        <button class="settings-action" id="sp-onboarding">
          <span class="settings-action-icon">👋</span>
          <div class="settings-action-text"><div class="settings-action-title">Show welcome screen again</div><div class="settings-action-desc">Revisit the privacy explanation and backup setup</div></div>
          <span class="settings-action-chevron">›</span>
        </button>
      </div>
      <div class="settings-version">Maké · V15 · All data stored locally on this device</div>
    </div>
  `;

  document.body.appendChild(page);
  requestAnimationFrame(() => page.classList.add('open'));
  setTimeout(() => page.querySelector('#settings-back')?.focus(), 440);

  const removeTrap = _focusTrap(page);

  const close = () => {
    removeTrap();
    page.classList.remove('open');
    setTimeout(() => { page.remove(); prevFocus?.focus(); }, 420);
  };

  page.querySelector('#settings-back').addEventListener('click', close);

  page.querySelector('#sp-theme-toggle').addEventListener('click', e => {
    const btn = e.currentTarget;
    const nowDark = btn.classList.toggle('on');
    btn.setAttribute('aria-pressed', nowDark);
    page.querySelector('#sp-theme-icon').textContent = nowDark ? '🌙' : '☀️';
    localStorage.setItem('make_theme', nowDark ? 'dark' : 'light');
    nowDark ? document.documentElement.setAttribute('data-theme','dark')
            : document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-toggle')?.classList.toggle('on', nowDark);
  });

  page.querySelector('#sp-view-grid').addEventListener('click', () => {
    state.viewMode = 'grid';
    page.querySelector('#sp-view-grid').classList.add('active');    page.querySelector('#sp-view-grid').setAttribute('aria-pressed','true');
    page.querySelector('#sp-view-list').classList.remove('active'); page.querySelector('#sp-view-list').setAttribute('aria-pressed','false');
  });
  page.querySelector('#sp-view-list').addEventListener('click', () => {
    state.viewMode = 'list';
    page.querySelector('#sp-view-list').classList.add('active');    page.querySelector('#sp-view-list').setAttribute('aria-pressed','true');
    page.querySelector('#sp-view-grid').classList.remove('active'); page.querySelector('#sp-view-grid').setAttribute('aria-pressed','false');
  });

  page.querySelector('#sp-ambient-toggle').addEventListener('click', async e => {
    const btn = e.currentTarget;
    state.ambientEnabled = !state.ambientEnabled;
    btn.classList.toggle('on', state.ambientEnabled);
    btn.setAttribute('aria-pressed', state.ambientEnabled);
    const { startAmbient, stopAmbient } = await import('../features/ambient.js');
    state.ambientEnabled ? startAmbient() : stopAmbient();
    document.getElementById('ambient-mini-toggle')?.classList.toggle('on', state.ambientEnabled);
  });

  page.querySelector('#sp-export').addEventListener('click', () => { close(); setTimeout(() => exportData(), 420); });
  page.querySelector('#sp-import').addEventListener('click', () => { close(); setTimeout(() => importData(), 420); });
  page.querySelector('#sp-onboarding').addEventListener('click', async () => {
    close();
    setTimeout(async () => {
      const { resetOnboarding, showOnboarding } = await import('../features/onboarding.js');
      resetOnboarding(); showOnboarding();
    }, 420);
  });

  const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

// ── Context menu ──────────────────────────────────────────────

export function showContextMenu(evt, item) {
  document.getElementById('ctx-overlay')?.remove();
  document.getElementById('ctx-menu')?.remove();
  const prevFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.id = 'ctx-overlay';
  overlay.className = 'context-menu-overlay';

  const menu = document.createElement('div');
  menu.id = 'ctx-menu';
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Item actions');

  const menuItems = [
    { label: item.isFavorited ? '⭐ Unfavourite' : '☆ Favourite', action: 'favorite' },
    { label: '⎘ Duplicate',  action: 'duplicate' },
    { label: '✎ Edit',       action: 'edit'      },
    { label: '↗ Save as…',   action: 'saveas'    },
    { divider: true },
    { label: '🗑 Delete', action: 'delete', destructive: true },
  ];

  menu.innerHTML = menuItems.map(a => a.divider
    ? `<div class="context-menu-divider" role="separator"></div>`
    : `<button class="context-menu-item ${a.destructive ? 'destructive' : ''}" data-action="${a.action}" role="menuitem">${a.label}</button>`
  ).join('');

  // Sticky colour picker
  if (item.type === 'sticky') {
    const colorRow = document.createElement('div');
    colorRow.className = 'ctx-color-row';
    colorRow.setAttribute('role', 'group');
    colorRow.setAttribute('aria-label', 'Sticky colour');
    STICKY_COLORS.forEach(c => {
      const dot = document.createElement('button');
      dot.className = 'ctx-color-dot';
      dot.style.background = c;
      dot.setAttribute('aria-label', `Set colour`);
      if (c === item.color) dot.style.borderColor = 'white';
      dot.addEventListener('click', async () => {
        dismiss();
        const updated = await saveItem({ ...item, color: c });
        upsertItemInState(updated);
        window._makeAutoBackup?.();
        showToast('Colour updated');
      });
      colorRow.appendChild(dot);
    });
    menu.appendChild(colorRow);
  }

  // Position with auto-flip
  const MENU_W = 210;
  const MENU_H = 250 + (item.type === 'sticky' ? 50 : 0);
  const x = evt.clientX ?? window.innerWidth  / 2;
  const y = evt.clientY ?? window.innerHeight / 2;
  const left = x + MENU_W > window.innerWidth  - 8 ? Math.max(8, x - MENU_W) : x;
  const top  = y + MENU_H > window.innerHeight - 8 ? Math.max(8, y - MENU_H) : y;
  menu.style.left = `${left}px`;
  menu.style.top  = `${top}px`;

  document.body.appendChild(overlay);
  document.body.appendChild(menu);
  requestAnimationFrame(() => menu.querySelector('.context-menu-item')?.focus());

  const dismiss = () => {
    overlay.remove(); menu.remove();
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus();
  };

  overlay.addEventListener('click', dismiss);

  const onKey = e => {
    if (e.key === 'Escape') { dismiss(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...menu.querySelectorAll('.context-menu-item')];
      const idx = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown'
        ? items[(idx + 1) % items.length]
        : items[(idx - 1 + items.length) % items.length];
      next?.focus();
    }
  };
  document.addEventListener('keydown', onKey);

  menu.querySelectorAll('.context-menu-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      dismiss();
      const action = btn.dataset.action;
      if (action === 'edit') {
        if (item.type === 'note')       { const m = await import('./note-editor.js'); m.showNoteEditor(item); }
        else if (item.type === 'code')  { const m = await import('./code-editor.js'); m.showCodeEditor(item); }
        else                            { showLinkModal(item); }
      } else if (action === 'favorite') {
        item.isFavorited = !item.isFavorited;
        upsertItemInState(await saveItem(item));
        window._makeAutoBackup?.();
        showToast(item.isFavorited ? 'Added to favourites' : 'Removed from favourites');
      } else if (action === 'duplicate') {
        const dup = createItem({ ...item, id: undefined, title: (item.title || 'Untitled') + ' copy', createdAt: undefined });
        upsertItemInState(await saveItem(dup));
        window._makeAutoBackup?.();
        showToast('Duplicated');
      } else if (action === 'saveas') {
        const { showSaveAsSheet } = await import('../features/save-as.js');
        showSaveAsSheet(item);
      } else if (action === 'delete') {
        await deleteItem(item.id);
        removeItemFromState(item.id);
        showToast('Deleted');
      }
    });
  });
}

// ── Lazy data module ──────────────────────────────────────────

function _lazyDataModule() {
  let _mod = null;
  const load = () => { if (!_mod) _mod = import('../features/data.js'); return _mod; };
  return {
    exportData: async () => { const m = await load(); m.exportData(); },
    importData: async () => { const m = await load(); m.importData(); },
  };
}
