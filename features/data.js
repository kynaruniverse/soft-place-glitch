/**
 * MAKÉ FEATURES — data.js (V3)
 *
 * V3: uses writeBackupFile / restoreFromBackupFile from storage.js
 * so export goes to a real device file (File System Access API) when
 * available, with a blob-download fallback for unsupported browsers.
 *
 * Import dedup logic unchanged from V2.
 */

import { state, upsertItemInState }                        from '../core/state.js';
import { saveItem, writeBackupFile, restoreFromBackupFile } from '../core/storage.js';
import { showToast }                                        from '../utils/helpers.js';

// ── Export ────────────────────────────────────────────────────

export async function exportData() {
  const all = [...state.backgroundItems, ...state.stickyItems];
  const ok  = await writeBackupFile(all, true); // true = always show picker
  if (ok !== false) showToast(`Exported ${all.length} item${all.length !== 1 ? 's' : ''} to file`);
}

// ── Import ────────────────────────────────────────────────────

export async function importData() {
  const incoming = await restoreFromBackupFile();
  if (!incoming) return; // user cancelled or error

  const existingFingerprints = new Set(
    [...state.backgroundItems, ...state.stickyItems].map(_fingerprint)
  );

  let added = 0, skipped = 0;
  for (const raw of incoming) {
    if (existingFingerprints.has(_fingerprint(raw))) { skipped++; continue; }
    const { id: _dropped, ...itemWithoutId } = raw;
    const saved = await saveItem(itemWithoutId);
    upsertItemInState(saved);
    existingFingerprints.add(_fingerprint(raw));
    added++;
  }

  const msg = skipped > 0
    ? `Imported ${added} item${added !== 1 ? 's' : ''} (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)`
    : `Imported ${added} item${added !== 1 ? 's' : ''}`;
  showToast(msg);
}

// ── Fingerprint ───────────────────────────────────────────────

function _fingerprint(item) {
  return [
    item.layer || '', item.type || '', item.title || '',
    item.content || '', item.code || '', item.url || '',
    item.text || '', item.language || '',
  ].join('\u0000');
}
