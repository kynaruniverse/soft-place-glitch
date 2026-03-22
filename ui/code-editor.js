/**
 * MAKÉ UI — code-editor.js (V15)
 *
 * V15 improvements:
 * - Save button disabled with spinner during async save
 * - Ctrl+F / Cmd+F opens inline find/replace bar
 * - Scroll position restored per item ID on re-open
 */

import { state, upsertItemInState } from '../core/state.js';
import { saveItem }                  from '../core/storage.js';
import { createItem, ItemType, ItemLayer } from '../core/schema.js';
import { esc, showToast }            from '../utils/helpers.js';
import { highlight }                 from '../utils/syntax.js';

const LANGUAGES = [
  'javascript','typescript','python','html','css','bash','json',
  'sql','java','swift','kotlin','rust','go','cpp','markdown','plaintext',
];

// Persist scroll per item
const _scrollPositions = new Map();

export function showCodeEditor(existingItem = null) {
  document.getElementById('code-editor-page')?.remove();

  const page = document.createElement('div');
  page.className = 'editor-page code-editor-page';
  page.id = 'code-editor-page';

  const currentLang = existingItem?.language || 'javascript';
  const currentCode = existingItem?.code     || '';

  page.innerHTML = `
    <div class="editor-topbar code-topbar">
      <button class="editor-back-btn" id="code-back" aria-label="Back">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <input class="code-filename-input" id="code-title" placeholder="filename.js"
             value="${esc(existingItem?.title || '')}" autocomplete="off" spellcheck="false">
      <button class="editor-save-btn" id="code-save">Save</button>
    </div>

    <div class="code-lang-strip" id="code-lang-strip">
      ${LANGUAGES.map(l =>
        `<button class="lang-tag ${l === currentLang ? 'active' : ''}" data-lang="${l}">${l}</button>`
      ).join('')}
    </div>

    <!-- Find/Replace bar (hidden by default) -->
    <div class="code-find-bar hidden" id="code-find-bar" role="search" aria-label="Find and replace">
      <input class="code-find-input" id="code-find-input" placeholder="Find…" autocomplete="off" spellcheck="false">
      <input class="code-replace-input" id="code-replace-input" placeholder="Replace with…" autocomplete="off" spellcheck="false">
      <span class="code-find-count" id="code-find-count"></span>
      <button class="code-find-btn" id="code-find-prev" title="Previous (Shift+Enter)">↑</button>
      <button class="code-find-btn" id="code-find-next" title="Next (Enter)">↓</button>
      <button class="code-find-btn" id="code-replace-one" title="Replace">⇄</button>
      <button class="code-find-btn" id="code-replace-all" title="Replace all">⇄⇄</button>
      <button class="code-find-close" id="code-find-close" aria-label="Close find bar">✕</button>
    </div>

    <div class="code-editor-frame" id="code-editor-frame">
      <div class="code-gutter" id="code-gutter"></div>
      <div class="code-highlight-wrap">
        <!-- Syntax highlight mirror (behind textarea) -->
        <pre class="code-highlight" id="code-highlight" aria-hidden="true"></pre>
        <textarea class="code-textarea code-textarea--transparent" id="code-textarea"
                  placeholder="// Start coding…"
                  spellcheck="false"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off">${esc(currentCode)}</textarea>
      </div>
    </div>

    <div class="code-statusbar">
      <span class="code-status-lang" id="code-status-lang">${currentLang}</span>
      <span class="code-status-pos"  id="code-status-pos">Ln 1, Col 1</span>
      <button class="code-copy-btn" id="code-copy" title="Copy to clipboard">
        <svg viewBox="0 0 24 24" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy
      </button>
    </div>
  `;

  document.body.appendChild(page);
  requestAnimationFrame(() => page.classList.add('open'));

  let selectedLang = currentLang;

  const textarea   = page.querySelector('#code-textarea');
  const highlight_ = page.querySelector('#code-highlight');
  const gutter     = page.querySelector('#code-gutter');
  const statusPos  = page.querySelector('#code-status-pos');
  const statusLang = page.querySelector('#code-status-lang');
  const findBar    = page.querySelector('#code-find-bar');
  const findInput  = page.querySelector('#code-find-input');
  const replaceInput = page.querySelector('#code-replace-input');
  const findCount  = page.querySelector('#code-find-count');

  // ── Highlight sync ────────────────────────────────────────────
  function refreshHighlight() {
    highlight_.innerHTML = highlight(textarea.value, selectedLang) + '\n';
  }

  function syncScroll() {
    highlight_.scrollTop  = textarea.scrollTop;
    highlight_.scrollLeft = textarea.scrollLeft;
    gutter.scrollTop      = textarea.scrollTop;
  }

  // ── Gutter ────────────────────────────────────────────────────
  function updateGutter() {
    const lines   = Math.max(textarea.value.split('\n').length, 20);
    const current = gutter.children.length;
    if (lines > current) {
      const frag = document.createDocumentFragment();
      for (let i = current + 1; i <= lines; i++) {
        const d = document.createElement('div');
        d.textContent = i;
        frag.appendChild(d);
      }
      gutter.appendChild(frag);
    } else if (lines < current) {
      while (gutter.children.length > lines) gutter.lastChild.remove();
    }
  }

  function updatePos() {
    const val   = textarea.value;
    const pos   = textarea.selectionStart;
    const lines = val.substring(0, pos).split('\n');
    statusPos.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
  }

  // ── Find/Replace ─────────────────────────────────────────────
  let _findMatches = [];
  let _findIdx     = 0;

  function _runFind() {
    _findMatches = [];
    const q = findInput.value;
    if (!q) { findCount.textContent = ''; return; }
    const text = textarea.value;
    let idx = 0;
    while ((idx = text.indexOf(q, idx)) !== -1) {
      _findMatches.push(idx);
      idx += q.length;
    }
    findCount.textContent = _findMatches.length
      ? `${Math.min(_findIdx + 1, _findMatches.length)} / ${_findMatches.length}`
      : 'No results';
    if (_findMatches.length) _jumpToMatch(_findIdx);
  }

  function _jumpToMatch(i) {
    if (!_findMatches.length) return;
    _findIdx = (i + _findMatches.length) % _findMatches.length;
    const pos = _findMatches[_findIdx];
    textarea.focus();
    textarea.setSelectionRange(pos, pos + findInput.value.length);
    findCount.textContent = `${_findIdx + 1} / ${_findMatches.length}`;
    // Scroll textarea so match is visible
    const lineH = 19.2;
    const lineNum = textarea.value.substring(0, pos).split('\n').length;
    textarea.scrollTop = Math.max(0, (lineNum - 3) * lineH);
    syncScroll();
  }

  function _openFindBar() {
    findBar.classList.remove('hidden');
    findInput.focus();
    findInput.select();
    _runFind();
  }

  function _closeFindBar() {
    findBar.classList.add('hidden');
    textarea.focus();
    _findMatches = [];
    findCount.textContent = '';
  }

  findInput.addEventListener('input', () => { _findIdx = 0; _runFind(); });
  page.querySelector('#code-find-prev').addEventListener('click', () => _jumpToMatch(_findIdx - 1));
  page.querySelector('#code-find-next').addEventListener('click', () => _jumpToMatch(_findIdx + 1));
  page.querySelector('#code-find-close').addEventListener('click', _closeFindBar);

  page.querySelector('#code-replace-one').addEventListener('click', () => {
    if (!_findMatches.length) return;
    const pos = _findMatches[_findIdx];
    const q   = findInput.value;
    const rep = replaceInput.value;
    textarea.value =
      textarea.value.substring(0, pos) + rep + textarea.value.substring(pos + q.length);
    updateGutter();
    refreshHighlight();
    _findIdx = 0;
    _runFind();
  });

  page.querySelector('#code-replace-all').addEventListener('click', () => {
    const q   = findInput.value;
    const rep = replaceInput.value;
    if (!q) return;
    textarea.value = textarea.value.split(q).join(rep);
    updateGutter();
    refreshHighlight();
    _runFind();
    showToast(`Replaced all occurrences of "${q}"`);
  });

  findInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.shiftKey) _jumpToMatch(_findIdx - 1);
    else if (e.key === 'Enter') _jumpToMatch(_findIdx + 1);
    else if (e.key === 'Escape') _closeFindBar();
  });

  // ── Events ────────────────────────────────────────────────────
  textarea.addEventListener('input', () => {
    updateGutter();
    updatePos();
    refreshHighlight();
  });

  textarea.addEventListener('scroll', syncScroll);
  textarea.addEventListener('click',  updatePos);
  textarea.addEventListener('keyup',  updatePos);

  textarea.addEventListener('keydown', e => {
    // Ctrl+F / Cmd+F → find
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      _openFindBar();
      return;
    }

    if (e.key === 'Escape' && !findBar.classList.contains('hidden')) {
      _closeFindBar();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const s   = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, s) + '  ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = s + 2;
      updateGutter();
      refreshHighlight();
    }

    // Auto-close brackets / quotes.
    const pairs = { '(':')', '[':']', '{':'}', '"':'"', "'":"'", '`':'`' };
    if (pairs[e.key]) {
      e.preventDefault();
      const s        = textarea.selectionStart;
      const end      = textarea.selectionEnd;
      const selected = textarea.value.substring(s, end);
      textarea.value =
        textarea.value.substring(0, s) + e.key + selected + pairs[e.key] + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = s + 1;
    }
  });

  // Language selector.
  page.querySelector('#code-lang-strip').addEventListener('click', e => {
    const tag = e.target.closest('.lang-tag');
    if (!tag) return;
    page.querySelectorAll('.lang-tag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
    selectedLang = tag.dataset.lang;
    statusLang.textContent = selectedLang;
    refreshHighlight();
  });

  // Copy.
  page.querySelector('#code-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(textarea.value)
      .then(() => showToast('Copied to clipboard'))
      .catch(() => showToast('Copy failed', true));
  });

  // ── Save / Close ─────────────────────────────────────────────
  const close = () => {
    if (existingItem?.id) _scrollPositions.set(existingItem.id, textarea.scrollTop);
    page.classList.remove('open');
    setTimeout(() => page.remove(), 320);
  };

  page.querySelector('#code-back').addEventListener('click', close);

  page.querySelector('#code-save').addEventListener('click', async () => {
    const saveBtn = page.querySelector('#code-save');
    if (saveBtn.classList.contains('loading')) return;

    const title = page.querySelector('#code-title').value.trim();
    const code  = textarea.value;
    if (!title && !code.trim()) { close(); return; }

    saveBtn.classList.add('loading');
    saveBtn.textContent = '';

    try {
      let saved;
      if (existingItem) {
        saved = await saveItem({ ...existingItem, title, code, language: selectedLang });
      } else {
        saved = await saveItem(createItem({
          layer: ItemLayer.BACKGROUND, type: ItemType.CODE, title, code, language: selectedLang,
        }));
      }
      upsertItemInState(saved);
      window._makeAutoBackup?.();
      showToast(existingItem ? 'Code updated' : 'Code saved');
      close();
    } catch (err) {
      console.error('[Maké] save code failed', err);
      showToast('Save failed — please try again', true);
      saveBtn.classList.remove('loading');
      saveBtn.textContent = 'Save';
    }
  });

  // ── Initial state ─────────────────────────────────────────────
  updateGutter();
  refreshHighlight();
  setTimeout(() => {
    textarea.focus();
    if (existingItem?.id && _scrollPositions.has(existingItem.id)) {
      textarea.scrollTop = _scrollPositions.get(existingItem.id);
      syncScroll();
    }
  }, 380);
}
