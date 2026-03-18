const DB_NAME = 'MakeDB';
const STORE_NAME = 'widgets';
const DB_VERSION = 1;

let db;
let dbReady = null;

function initDB() {
    if (dbReady) return dbReady;
    dbReady = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('type', 'type');
                store.createIndex('createdAt', 'createdAt');
            }
        };
    });
    return dbReady;
}

// Wait for DB before any operation
async function ensureDB() {
    await initDB();
}

export async function getAllWidgets() {
    await ensureDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

export async function saveWidget(widget) {
    await ensureDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (widget.id) {
        store.put(widget);
    } else {
        widget.createdAt = Date.now();
        store.add(widget);
    }
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
}

export async function deleteWidget(id) {
    await ensureDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
}

export async function clearAll() {
    await ensureDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
}

// Initialize on module load (but no need to await here)
initDB().catch(console.error);
