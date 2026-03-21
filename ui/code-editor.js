/**
 * MAKÉ UI — code-editor.js (V1)
 * Full-screen code editor using the highlight-overlay pattern.
 *
 * Architecture:
 *   A transparent <textarea> sits on top of a <pre> element.
 *   The <pre> renders syntax-highlighted HTML via utils/syntax.js.
 *   The <textarea> owns all cursor / selection / input behaviour.
 *   Scroll events are mirrored from the textarea to the <pre> so
 *   highlighted text never drifts out of alignment.
 *
 * Features:
 *   – 16 languages with one-tap switching
 *   – Line number gutter (synced with textarea scroll)
 *   – Tab key inserts 2 spaces (no focus loss)
 *   – Cursor position shown in status bar (Ln / Col)
 *   – One-click copy to clipboard
 *   – Ctrl/Cmd+S to save, Escape to close
 */

import { state, upsertItemInState } from '../core/state.js';
import { saveItem }                  from '../core/storage.js';
import { createItem }                from '../core/schema.js';
import { esc, showToast }            from '../utils/helpers.js';
import { highlight }                 from '../utils/syntax.js';

const LANGS = [
  'javascript','typescript','python','html','css',
  'json','bash','sql','java','rust','go','swift',
  'kotlin','cpp','markdown','plaintext',
];

export function showCodeEditor(existing = null) {
  if (document.getElementById('code-editor-page')) return;

  let currentLang = existing?.language || 'javascript';

  const page = document.createElement('div');
  page.id        = 'code-editor-page';
  page.className = 'editor-page code-editor-page';
  page.setAttribute('role', 'dialog');
  page.setAttribute('aria-modal', 'true');
  page.setAttribute('aria-label', existing ? 'Edit snippet' : 'New snippet');

  page.innerHTML = `
    <div class="editor-topbar code-topbar">
      <button class="editor-back-btn" id="code-back" aria-label="Back">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <input class="code-filename-input" id="code-title"
             placeholder="snippet title…" autocomplete="off"
             value="${esc(existing?.title || '')}">
      <button class="editor-save-btn" id="code-save">Save</button>
    </div>

    <div class="code-lang-strip" id="code-lang-strip" role="tablist" aria-label="Language">
      ${LANGS.map(l =>
        `<button class="lang-tag ${l === currentLang ? 'active' : ''}"
                 data-lang="${l}" role="tab"
                 aria-selected="${l === currentLang}">${l}</button>`
      ).join('')}
    </div>

    <div class="code-editor-frame">
      <div class="code-gutter" id="code-gutter" aria-hidden="true"></div>
      <div class="code-highlight-wrap">
        <pre class="code-highlight" id="code-highlight" aria-hidden="true"></pre>
        <textarea
          class="code-textarea code-textarea--transparent"
          id="code-area"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          autocomplete="off"
          wrap="off"
          aria-label="Code content"
          placeholder="// Start coding…"
        >${esc(existing?.code || '')}</textarea>
      </div>
    </div>

    <div class="code-statusbar" aria-live="polite">
      <span class="code-status-lang" id="code-status-lang">${currentLang}</span>
      <span class="code-status-pos"  id="code-status-pos">Ln 1, Col 1</span>
      <button class="code-copy-btn" id="code-copy" aria-label="Copy code">
        <svg width="12" height="12" viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copy
      </button>
    </div>`;

  document.body.appendChild(page);
  requestAnimationFrame(() => page.classList.add('open'));

  const area      = page.querySelector('#code-area');
  const hlPre     = page.querySelector('#code-highlight');
  const gutter    = page.querySelector('#code-gutter');
  const statusPos = page.querySelector('#code-status-pos');
  const statusLng = page.querySelector('#code-status-lang');

  // ── Sync highlight + gutter ───────────────────────────────────
  const _sync = () => {
    const code  = area.value;
    // Trailing newline prevents the last line from causing a height/scroll mismatch
    hlPre.innerHTML = highlight(code, currentLang) + '\n';
    // Line numbers
    const lineCount = (code.match(/\n/g) || []).length + 1;
    gutter.innerHTML = Array.from(
      { length: lineCount },
      (_, i) => `<div>${i + 1}</div>`
    ).join('');
    // Mirror scroll position
    hlPre.scrollTop  = area.scrollTop;
    hlPre.scrollLeft = area.scrollLeft;
  };

  const _syncPos = () => {
    const val   = area.value;
    const pos   = area.selectionStart;
    const lines = val.slice(0, pos).split('\n');
    statusPos.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
  };

  const _syncScroll = () => {
    hlPre.scrollTop  = area.scrollTop;
    hlPre.scrollLeft = area.scrollLeft;
    // Also scroll gutter to match vertical position
    gutter.scrollTop = area.scrollTop;
  };

  area.addEventListener('input',  _sync);
  area.addEventListener('scroll', _syncScroll);
  area.addEventListener('keyup',  _syncPos);
  area.addEventListener('click',  _syncPos);
  area.addEventListener('focus',  _syncPos);

  // ── Tab key → 2 spaces ────────────────────────────────────────
  area.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = area.selectionStart;
      const end   = area.selectionEnd;
      area.value  = area.value.slice(0, start) + '  ' + area.value.slice(end);
      area.selectionStart = area.selectionEnd = start + 2;
      _sync();
      _syncPos();
    }
  });

  // Initial render
  _sync();
  _syncPos();

  // ── Language selector ─────────────────────────────────────────
  page.querySelector('#code-lang-strip').addEventListener('click', e => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    currentLang = btn.dataset.lang;
    page.querySelectorAll('.lang-tag').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === currentLang);
      b.setAttribute('aria-selected', b.dataset.lang === currentLang);
    });
    statusLng.textContent = currentLang;
    _sync();
  });

  // ── Copy ──────────────────────────────────────────────────────
  page.querySelector('#code-copy').addEventListener('click', async () => {
    const copyBtn = page.querySelector('#code-copy');
    try {
      await navigator.clipboard.writeText(area.value);
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"/>
      </svg> Copied!`;
      setTimeout(() => { copyBtn.innerHTML = orig; }, 1800);
    } catch {
      showToast('Copy failed — check clipboard permissions', true);
    }
  });

  // ── Save ──────────────────────────────────────────────────────
  const _save = async () => {
    const title    = page.querySelector('#code-title').value.trim() || 'Untitled';
    const code     = area.value;
    const item     = existing
      ? { ...existing, title, code, language: currentLang }
      : createItem({ type: 'code', layer: 'background', title, code, language: currentLang });
    try {
      const saved = await saveItem(item);
      upsertItemInState(saved);
      showToast(existing ? 'Snippet saved' : 'Snippet created');
      _close();
    } catch (err) {
      console.error('[CodeEditor] Save failed:', err);
      showToast('Save failed', true);
    }
  };

  const _close = () => {
    page.classList.remove('open');
    setTimeout(() => page.remove(), 420);
  };

  page.querySelector('#code-save').addEventListener('click', _save);
  page.querySelector('#code-back').addEventListener('click', _close);

  // ── Keyboard shortcuts ────────────────────────────────────────
  page.addEventListener('keydown', e => {
    if (e.key === 'Escape' && e.target !== area) { _close(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); _save(); }
  });

  // ── Initial focus ─────────────────────────────────────────────
  setTimeout(() => area.focus(), 430);
}
