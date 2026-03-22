/**
 * MAKÉ FEATURES — save-as.js (V15)
 *
 * V15 improvements:
 *   – Swipe-down gesture to dismiss the bottom sheet
 *   – Focus management: first option focused on open, restored on close
 *   – Focus trap within the sheet
 *   – Escape key closes
 */

import { esc, showToast } from '../utils/helpers.js';

const LANG_EXT = {
  javascript:'js', typescript:'ts', python:'py', html:'html', css:'css',
  json:'json', bash:'sh', sql:'sql', java:'java', rust:'rs', go:'go',
  swift:'swift', kotlin:'kt', cpp:'cpp', markdown:'md', plaintext:'txt',
};

export function showSaveAsSheet(item) {
  document.getElementById('save-as-overlay')?.remove();

  const prevFocus = document.activeElement;
  const options   = _buildOptions(item);

  const overlay = document.createElement('div');
  overlay.id        = 'save-as-overlay';
  overlay.className = 'save-as-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'save-as-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Save as');

  sheet.innerHTML = `
    <div class="save-as-handle" aria-hidden="true"></div>
    <div class="save-as-title">Save as…</div>
    <div class="save-as-subtitle">${esc(item.title || 'Untitled')}</div>
    <div class="save-as-options">
      ${options.map((opt, i) => `
        <button class="save-as-option" data-idx="${i}">
          <span class="save-as-option-icon">${opt.icon}</span>
          <div class="save-as-option-text">
            <div class="save-as-option-label">${opt.label}</div>
            <div class="save-as-option-desc">${opt.desc}</div>
          </div>
          <span class="save-as-option-ext">${opt.ext}</span>
        </button>`).join('')}
    </div>
    <button class="save-as-cancel">Cancel</button>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    sheet.classList.add('open');
  });

  // Focus first option
  setTimeout(() => sheet.querySelector('.save-as-option, .save-as-cancel')?.focus(), 340);

  // ── Focus trap ────────────────────────────────────────────────
  const SEL = 'button:not([disabled])';
  const trapKey = e => {
    if (e.key !== 'Tab') return;
    const els = [...sheet.querySelectorAll(SEL)];
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  };
  sheet.addEventListener('keydown', trapKey);

  const close = () => {
    sheet.removeEventListener('keydown', trapKey);
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('open');
    sheet.classList.remove('open');
    setTimeout(() => { overlay.remove(); prevFocus?.focus(); }, 320);
  };

  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  sheet.querySelector('.save-as-cancel').addEventListener('click', close);

  // ── Swipe-down to close ───────────────────────────────────────
  let startY = 0, currentY = 0, dragging = false;
  const THRESHOLD = 80; // px to trigger close

  sheet.addEventListener('touchstart', e => {
    // Only start swipe from the handle area or top region
    const touch = e.touches[0];
    const rect  = sheet.getBoundingClientRect();
    if (touch.clientY - rect.top > 70) return; // only top 70px triggers swipe
    startY   = touch.clientY;
    currentY = touch.clientY;
    dragging = true;
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = Math.max(0, currentY - startY);
    sheet.style.transform = `translateY(${delta}px)`;
    sheet.style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    const delta = currentY - startY;
    sheet.style.transition = '';
    sheet.style.transform  = '';
    if (delta > THRESHOLD) close();
  });

  // ── Option actions ────────────────────────────────────────────
  sheet.querySelectorAll('.save-as-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const opt = options[+btn.dataset.idx];
      close();
      await _runOption(opt, item);
    });
  });
}

// ── Build options per item type ───────────────────────────────

function _buildOptions(item) {
  if (item.type === 'note') return [
    { icon:'📄', label:'Plain text',  desc:'Simple .txt file — opens anywhere',                    ext:'.txt', action:'note-txt' },
    { icon:'📝', label:'Markdown',    desc:'Formatted .md for Notion, Obsidian, etc.',             ext:'.md',  action:'note-md'  },
  ];
  if (item.type === 'code') {
    const lang = item.language || 'plaintext';
    const ext  = LANG_EXT[lang] || 'txt';
    return [
      { icon:'💾', label:`${lang.charAt(0).toUpperCase()+lang.slice(1)} source`, desc:`Saves as a real .${ext} file`, ext:`.${ext}`, action:'code-source' },
      { icon:'📄', label:'Plain text', desc:'Generic .txt version', ext:'.txt', action:'code-txt' },
    ];
  }
  if (item.type === 'link') return [
    { icon:'📋', label:'Copy URL',     desc:'Copies the link to your clipboard', ext:'clipboard', action:'link-copy' },
    { icon:'📄', label:'Save as text', desc:'Saves URL and label as a .txt file', ext:'.txt',     action:'link-txt'  },
  ];
  if (item.type === 'sticky') return [
    { icon:'📄', label:'Plain text', desc:'Saves your sticky note as a .txt file', ext:'.txt', action:'sticky-txt' },
  ];
  return [];
}

// ── Run the chosen option ─────────────────────────────────────

async function _runOption(opt, item) {
  switch (opt.action) {
    case 'note-txt': {
      const plain = _htmlToPlain(item.content || '');
      await _saveFile(`${item.title||'Untitled'}\n${'─'.repeat(40)}\n\n${plain}`, `${_slug(item.title)}.txt`, 'text/plain', [{description:'Text file',accept:{'text/plain':['.txt']}}]);
      break;
    }
    case 'note-md': {
      const md = _htmlToMarkdown(item.content || '');
      await _saveFile(`# ${item.title||'Untitled'}\n\n${md}`, `${_slug(item.title)}.md`, 'text/markdown', [{description:'Markdown file',accept:{'text/markdown':['.md']}}]);
      break;
    }
    case 'code-source': {
      const lang = item.language || 'plaintext';
      const ext  = LANG_EXT[lang] || 'txt';
      const mime = ext==='html'?'text/html':ext==='css'?'text/css':ext==='json'?'application/json':'text/plain';
      await _saveFile(item.code||'', `${_slug(item.title)}.${ext}`, mime, [{description:`${lang} file`,accept:{[mime]:[`.${ext}`]}}]);
      break;
    }
    case 'code-txt':
      await _saveFile(item.code||'', `${_slug(item.title)}.txt`, 'text/plain', [{description:'Text file',accept:{'text/plain':['.txt']}}]);
      break;
    case 'link-copy':
      try { await navigator.clipboard.writeText(item.url||''); showToast('URL copied to clipboard'); }
      catch { showToast('Could not copy — try long-pressing the URL', true); }
      break;
    case 'link-txt':
      await _saveFile(`${item.title||'Link'}\n${item.url||''}\n\nSaved from Maké`, `${_slug(item.title)}.txt`, 'text/plain', [{description:'Text file',accept:{'text/plain':['.txt']}}]);
      break;
    case 'sticky-txt':
      await _saveFile(item.text||'', 'sticky-note.txt', 'text/plain', [{description:'Text file',accept:{'text/plain':['.txt']}}]);
      break;
  }
}

async function _saveFile(content, suggestedName, mimeType, types) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle   = await window.showSaveFilePicker({ suggestedName, types });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      showToast(`Saved as ${suggestedName}`);
      return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  const blob = new Blob([content], { type: mimeType });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: suggestedName });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Downloading ${suggestedName}`);
}

function _htmlToPlain(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

function _htmlToMarkdown(html) {
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_,t)=>`## ${_strip(t)}\n\n`)
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi,   (_,t)=>`**${_strip(t)}**`)
    .replace(/<b[^>]*>(.*?)<\/b>/gi,             (_,t)=>`**${_strip(t)}**`)
    .replace(/<em[^>]*>(.*?)<\/em>/gi,           (_,t)=>`_${_strip(t)}_`)
    .replace(/<i[^>]*>(.*?)<\/i>/gi,             (_,t)=>`_${_strip(t)}_`)
    .replace(/<s[^>]*>(.*?)<\/s>/gi,             (_,t)=>`~~${_strip(t)}~~`)
    .replace(/<u[^>]*>(.*?)<\/u>/gi,             (_,t)=>_strip(t))
    .replace(/<li[^>]*>(.*?)<\/li>/gi,           (_,t)=>`- ${_strip(t)}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>(.*?)<\/div>/gi,         (_,t)=>`${_strip(t)}\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gi,             (_,t)=>`${_strip(t)}\n\n`)
    .replace(/<[^>]+>/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/\n{3,}/g,'\n\n').trim();
}

function _strip(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}

function _slug(title='') {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'untitled';
}
