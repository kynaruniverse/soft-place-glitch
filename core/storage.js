/**
 * MAKÉ CORE — storage.js (V4)
 * Changes from V3:
 * - FIX: localStorage fallback when IndexedDB is unavailable (private browsing
 *   on some browsers, broken permissions, quota errors).  Data is silently
 *   routed to localStorage instead of being lost.
 */

import { extendItem, nextCheckpoint } from './schema.js';

const DB_NAME    = 'MakeDB';
const STORE_NAME = 'items';
const DB_VERSION = 2;

// ── IndexedDB ─────────────────────────────────────────────────

const getDB = (() => {
  let promise;
  return () => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror   = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('type',  'type');
            store.createIndex('layer', 'layer');
          }
        };
      });
    }
    return promise;
  };
})();

// ── localStorage fallback ─────────────────────────────────────
//
// Activated automatically when IndexedDB throws on open.
// Uses a single JSON blob keyed at 'make_items_ls'.
// IDs are assigned from a monotonic counter stored at 'make_items_ls_seq'.
//
const LS_ITEMS_KEY = 'make_items_ls';
const LS_SEQ_KEY   = 'make_items_ls_seq';

let _usingFallback = false;

function _lsGetAll() {
  try { return JSON.parse(localStorage.getItem(LS_ITEMS_KEY) || '[]'); } catch { return []; }
}

function _lsSave(items) {
  try { localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(items)); } catch (e) {
    console.warn('[Maké] localStorage full — could not save items:', e);
  }
}

function _lsNextId() {
  const seq = (parseInt(localStorage.getItem(LS_SEQ_KEY) || '0', 10) || 0) + 1;
  localStorage.setItem(LS_SEQ_KEY, String(seq));
  return seq;
}

async function _lsGetAllItems() {
  return _lsGetAll().map(extendItem);
}

async function _lsSaveItem(item) {
  const toSave = { ...item, checkpoint: nextCheckpoint(item), updatedAt: Date.now() };
  if (!toSave.createdAt) toSave.createdAt = Date.now();
  const items = _lsGetAll();
  if (toSave.id) {
    const idx = items.findIndex(i => i.id === toSave.id);
    if (idx >= 0) items[idx] = toSave; else items.push(toSave);
  } else {
    toSave.id = _lsNextId();
    items.push(toSave);
  }
  _lsSave(items);
  return toSave;
}

async function _lsDeleteItem(id) {
  _lsSave(_lsGetAll().filter(i => i.id !== id));
}

async function _lsUpdateItemPosition(id, position) {
  const items = _lsGetAll();
  const item  = items.find(i => i.id === id);
  if (item) { item.position = position; item.updatedAt = Date.now(); }
  _lsSave(items);
}

// ── Dispatch helpers ──────────────────────────────────────────

async function _withDB(fn) {
  if (_usingFallback) return null;
  try {
    const db = await getDB();
    return await fn(db);
  } catch (err) {
    if (!_usingFallback) {
      console.warn('[Maké] IndexedDB unavailable — switching to localStorage fallback.', err);
      _usingFallback = true;
    }
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────

export async function getAllItems() {
  if (_usingFallback) return _lsGetAllItems();

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result || []).map(extendItem));
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Maké] IndexedDB unavailable — switching to localStorage fallback.', err);
    _usingFallback = true;
    return _lsGetAllItems();
  }
}

export async function saveItem(item) {
  if (_usingFallback) return _lsSaveItem(item);

  try {
    const db    = await getDB();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const toSave = { ...item, checkpoint: nextCheckpoint(item), updatedAt: Date.now() };
    if (!toSave.createdAt) toSave.createdAt = Date.now();

    return new Promise((resolve, reject) => {
      let req;
      if (toSave.id) {
        req = store.put(toSave);
      } else {
        const { id: _dropped, ...rest } = toSave;
        req = store.add(rest);
      }
      req.onsuccess = () => resolve({ ...toSave, id: req.result ?? toSave.id });
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Maké] saveItem IndexedDB error — using fallback:', err);
    _usingFallback = true;
    return _lsSaveItem(item);
  }
}

export async function deleteItem(id) {
  if (_usingFallback) return _lsDeleteItem(id);

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Maké] deleteItem IndexedDB error — using fallback:', err);
    _usingFallback = true;
    return _lsDeleteItem(id);
  }
}

export async function updateItemPosition(id, position) {
  if (_usingFallback) return _lsUpdateItemPosition(id, position);

  try {
    const db    = await getDB();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) { resolve(); return; }
        item.position  = position;
        item.updatedAt = Date.now();
        const putReq   = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror   = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('[Maké] updateItemPosition IndexedDB error — using fallback:', err);
    _usingFallback = true;
    return _lsUpdateItemPosition(id, position);
  }
}

/** Returns true if the app is running on the localStorage fallback. */
export function isUsingFallback() { return _usingFallback; }
