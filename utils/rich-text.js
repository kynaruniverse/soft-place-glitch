/**
 * MAKÉ UTILS — rich-text.js
 *
 * ⚠️  DEPRECATION NOTICE
 * document.execCommand() was removed from the HTML spec in 2020 and lives
 * only as a "legacy feature" that browsers keep for compatibility.  Chrome
 * has not yet removed it (as of 2025) but has flagged it for eventual
 * removal.  All rich-text commands are funnelled through this module so
 * that the future migration to a Selection/Range-based implementation is a
 * single-file change.
 *
 * Migration path (when execCommand finally dies):
 *   execFormat('bold')      → toggleInlineTag('strong')
 *   execFormat('italic')    → toggleInlineTag('em')
 *   execFormat('underline') → toggleInlineTag('u')
 *   execFormat('foreColor', val) → wrapWithStyle('color', val)
 *   execFormat('fontSize')  → wrapWithStyle('font-size', FONT_SIZES[val])
 *   execFormat('formatBlock','h2') → replaceBlock('h2')
 *   Lists/indent still need a lightweight library (Trix, ProseMirror-lite).
 */

const FONT_SIZES = {
  2: '0.75em',   // xs
  3: '1em',      // sm / normal
  5: '1.4em',    // lg
};

/**
 * execFormat(cmd, value?)
 * Execute a formatting command on the current contenteditable selection.
 * Returns true if the command was applied, false if it failed.
 */
export function execFormat(cmd, value = null) {
  try {
    // execCommand is synchronous and runs against the focused element.
    // eslint-disable-next-line no-document-execcommand-deprecated
    return document.execCommand(cmd, false, value ?? null);
  } catch (err) {
    console.warn('[RichText] execCommand("' + cmd + '") failed — browser may have removed it.', err);
    // Attempt manual fallback for the most common inline commands.
    return _manualFormat(cmd, value);
  }
}

/**
 * queryFormat(cmd)
 * Returns true if the selection currently has the given formatting active.
 */
export function queryFormat(cmd) {
  try {
    return document.queryCommandState(cmd);
  } catch {
    return false;
  }
}

// ── Manual fallback (used only when execCommand throws) ───────

const TAG_MAP = {
  bold:          'strong',
  italic:        'em',
  underline:     'u',
  strikeThrough: 's',
};

function _manualFormat(cmd, value) {
  const tag = TAG_MAP[cmd];
  if (tag) return _toggleInlineTag(tag);

  if (cmd === 'foreColor' && value) return _wrapWithStyle('color', value);

  if (cmd === 'fontSize' && value) {
    const size = FONT_SIZES[value] || '1em';
    return _wrapWithStyle('font-size', size);
  }

  if (cmd === 'formatBlock' && value) return _replaceBlock(value);

  // Lists and indentation are complex — no reliable manual fallback.
  console.warn('[RichText] No manual fallback for command:', cmd);
  return false;
}

function _toggleInlineTag(tagName) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);

  // Walk ancestors to see if the selection is already inside this tag.
  let node = range.commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentNode;
  const existing = node.closest?.(tagName);

  if (existing) {
    // Unwrap: move children out, remove empty wrapper.
    const parent = existing.parentNode;
    while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
    parent.removeChild(existing);
  } else {
    // Wrap selection contents in the tag.
    try {
      const el = document.createElement(tagName);
      range.surroundContents(el);
    } catch {
      // surroundContents throws on cross-node selections.
      const el = document.createElement(tagName);
      el.appendChild(range.extractContents());
      range.insertNode(el);
    }
  }
  return true;
}

function _wrapWithStyle(prop, val) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const span  = document.createElement('span');
  span.style[prop] = val;
  try {
    range.surroundContents(span);
  } catch {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
  return true;
}

function _replaceBlock(blockTag) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range  = sel.getRangeAt(0);
  let   anchor = range.startContainer;
  if (anchor.nodeType === 3) anchor = anchor.parentNode;
  const block = anchor.closest?.('div,p,h1,h2,h3,h4,h5,h6') || anchor;
  if (!block) return false;
  const newBlock = document.createElement(blockTag);
  newBlock.innerHTML = block.innerHTML;
  block.replaceWith(newBlock);
  return true;
}
