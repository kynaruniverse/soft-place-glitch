// ==================== Core App State ====================
const STORE_NAME = 'widgets';
const DB_NAME = 'SoftPlace2035';
const DB_VERSION = 1;

let db;
let currentTab = 'notes';
let widgets = [];
let smartEnabled = false;

// DOM elements
const appEl = document.getElementById('app');
const tabBar = document.getElementById('tab-bar');
const tabContent = document.getElementById('tab-content');
const cmdButton = document.getElementById('cmd-button');
const cmdPalette = document.getElementById('command-palette');
const cmdInput = document.getElementById('command-input');
const cmdResults = document.getElementById('command-results');
const smartToggle = document.getElementById('smart-toggle');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalCancel = document.getElementById('modal-cancel');
const modalOk = document.getElementById('modal-ok');

// ==================== IndexedDB Initialization ====================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// ==================== Widget CRUD ====================
async function loadWidgets() {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            widgets = request.result || [];
            resolve(widgets);
        };
    });
}

async function saveWidget(widget) {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (widget.id) {
        store.put(widget);
    } else {
        store.add(widget);
    }
    await loadWidgets();
    render();
}

async function deleteWidget(id) {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await loadWidgets();
    render();
}

// ==================== Render Tabs and Widgets ====================
const tabs = [
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'code', label: 'Code', icon: '</>' },
    { id: 'links', label: 'Links', icon: '🔗' },
    { id: 'stickies', label: 'Sticky', icon: '📌' }
];

function renderTabs() {
    tabBar.innerHTML = '';
    tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = `tab ${currentTab === tab.id ? 'active' : ''}`;
        btn.dataset.tab = tab.id;
        btn.textContent = `${tab.icon} ${tab.label}`;
        btn.addEventListener('click', () => {
            currentTab = tab.id;
            renderTabs();
            render();
        });
        tabBar.appendChild(btn);
    });
}

function render() {
    const filtered = widgets.filter(w => w.type === currentTab.slice(0, -1) || (currentTab === 'stickies' && w.type === 'sticky'));
    // Apply smart sorting if enabled
    let sorted = filtered;
    if (smartEnabled) {
        sorted = smartSort(filtered);
    }
    tabContent.innerHTML = `<div class="widget-grid">${
        sorted.map(w => renderWidgetCard(w)).join('')
    }</div>`;
}

function renderWidgetCard(w) {
    let contentHtml = '';
    switch (w.type) {
        case 'note':
            contentHtml = `<div class="widget-content">${escapeHTML(w.content.substring(0, 200))}${w.content.length > 200 ? '…' : ''}</div>`;
            break;
        case 'code':
            contentHtml = `<pre class="widget-code"><code>${escapeHTML(w.code.substring(0, 150))}${w.code.length > 150 ? '…' : ''}</code></pre>`;
            break;
        case 'link':
            contentHtml = `<a href="${escapeHTML(w.url)}" target="_blank" class="widget-link">${escapeHTML(w.title || w.url)}</a>`;
            break;
        case 'sticky':
            contentHtml = `<div class="widget-content" style="background:${w.color || '#2a2f33'}; padding:12px; border-radius:12px;">${escapeHTML(w.text)}</div>`;
            break;
    }
    return `
        <div class="widget-card" data-id="${w.id}" data-type="${w.type}">
            <div class="widget-header">
                <span>${w.type}</span>
                <span>${new Date(w.created || Date.now()).toLocaleDateString()}</span>
            </div>
            <div class="widget-title">${escapeHTML(w.title || 'Untitled')}</div>
            ${contentHtml}
            <div class="widget-footer">
                <button class="edit-widget" data-id="${w.id}">✎</button>
                <button class="delete-widget" data-id="${w.id}">✕</button>
            </div>
        </div>
    `;
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

// ==================== Smart Sorting ====================
function smartSort(widgets) {
    const hour = new Date().getHours();
    // Morning (5-11): notes first, then stickies
    // Afternoon (12-17): links first
    // Evening (18-4): code first
    if (hour >= 5 && hour < 12) {
        return widgets.sort((a,b) => {
            if (a.type === 'note') return -1;
            if (b.type === 'note') return 1;
            if (a.type === 'sticky') return -1;
            if (b.type === 'sticky') return 1;
            return 0;
        });
    } else if (hour >= 12 && hour < 18) {
        return widgets.sort((a,b) => {
            if (a.type === 'link') return -1;
            if (b.type === 'link') return 1;
            return 0;
        });
    } else {
        return widgets.sort((a,b) => {
            if (a.type === 'code') return -1;
            if (b.type === 'code') return 1;
            return 0;
        });
    }
}

// ==================== Command Palette ====================
cmdButton.addEventListener('click', toggleCommandPalette);
cmdInput.addEventListener('input', handleCommandInput);
cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCommandPalette();
    if (e.key === 'Enter') executeCommand(cmdInput.value);
});

function toggleCommandPalette() {
    cmdPalette.classList.toggle('hidden');
    if (!cmdPalette.classList.contains('hidden')) {
        cmdInput.focus();
    }
}

function hideCommandPalette() {
    cmdPalette.classList.add('hidden');
    cmdInput.value = '';
    cmdResults.innerHTML = '';
}

function handleCommandInput() {
    const text = cmdInput.value.trim();
    if (!text) {
        cmdResults.innerHTML = '';
        return;
    }
    // Show suggestions
    const suggestions = [];
    if (text.startsWith('note ')) {
        suggestions.push({ text: `Create note: "${text.slice(5)}"`, action: () => createNote(text.slice(5)) });
    } else if (text.startsWith('code ')) {
        suggestions.push({ text: `Create code snippet: "${text.slice(5)}"`, action: () => createCode(text.slice(5)) });
    } else if (text.startsWith('link ')) {
        suggestions.push({ text: `Create link: "${text.slice(5)}"`, action: () => createLink(text.slice(5)) });
    } else if (text.startsWith('sticky ')) {
        suggestions.push({ text: `Create sticky: "${text.slice(7)}"`, action: () => createSticky(text.slice(7)) });
    } else {
        // Search existing
        widgets.forEach(w => {
            if (w.title && w.title.toLowerCase().includes(text.toLowerCase())) {
                suggestions.push({ text: `📄 ${w.title} (${w.type})`, action: () => openWidget(w.id) });
            }
        });
    }
    cmdResults.innerHTML = suggestions.map(s => `<div class="command-result-item">${escapeHTML(s.text)}</div>`).join('');
    Array.from(document.querySelectorAll('.command-result-item')).forEach((el, i) => {
        el.addEventListener('click', suggestions[i].action);
    });
}

function executeCommand(text) {
    handleCommandInput(); // triggers suggestions; we'll just pick first if any
    const first = document.querySelector('.command-result-item');
    if (first) first.click();
    hideCommandPalette();
}

// Command actions
function createNote(title) {
    showModal('New Note', `
        <input id="modal-note-title" placeholder="Title" value="${escapeHTML(title)}">
        <textarea id="modal-note-content" placeholder="Note content"></textarea>
    `, async () => {
        const t = document.getElementById('modal-note-title').value;
        const c = document.getElementById('modal-note-content').value;
        if (t || c) {
            await saveWidget({ type: 'note', title: t, content: c, created: Date.now() });
        }
    });
}

function createCode(title) {
    showModal('New Code', `
        <input id="modal-code-title" placeholder="Title" value="${escapeHTML(title)}">
        <textarea id="modal-code-content" placeholder="Code"></textarea>
        <select id="modal-code-lang">
            <option>javascript</option><option>python</option><option>html</option><option>css</option>
        </select>
    `, async () => {
        const t = document.getElementById('modal-code-title').value;
        const c = document.getElementById('modal-code-content').value;
        const l = document.getElementById('modal-code-lang').value;
        await saveWidget({ type: 'code', title: t, code: c, language: l, created: Date.now() });
    });
}

function createLink(url) {
    showModal('New Link', `
        <input id="modal-link-url" placeholder="URL" value="${escapeHTML(url)}">
        <input id="modal-link-title" placeholder="Title (optional)">
    `, async () => {
        const u = document.getElementById('modal-link-url').value;
        const t = document.getElementById('modal-link-title').value;
        if (u) {
            await saveWidget({ type: 'link', url: u, title: t, created: Date.now() });
        }
    });
}

function createSticky(text) {
    showModal('New Sticky', `
        <textarea id="modal-sticky-text" placeholder="Sticky note">${escapeHTML(text)}</textarea>
        <input id="modal-sticky-color" type="color" value="#2a5f3a">
    `, async () => {
        const txt = document.getElementById('modal-sticky-text').value;
        const col = document.getElementById('modal-sticky-color').value;
        if (txt) {
            await saveWidget({ type: 'sticky', text: txt, color: col, created: Date.now() });
        }
    });
}

function openWidget(id) {
    // Switch to appropriate tab and scroll to widget
    const widget = widgets.find(w => w.id === id);
    if (widget) {
        currentTab = widget.type + 's'; // notes, code, links, stickies
        renderTabs();
        render();
        // Scroll into view after render
        setTimeout(() => {
            const el = document.querySelector(`.widget-card[data-id="${id}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

// ==================== Modal ====================
function showModal(title, contentHtml, onOK) {
    modalTitle.textContent = title;
    modalContent.innerHTML = contentHtml;
    modalOverlay.classList.remove('hidden');
    modalOk.onclick = () => {
        onOK();
        modalOverlay.classList.add('hidden');
    };
    modalCancel.onclick = () => modalOverlay.classList.add('hidden');
}

// ==================== Ambient Intelligence Toggle ====================
smartToggle.addEventListener('click', () => {
    smartEnabled = !smartEnabled;
    smartToggle.classList.toggle('active', smartEnabled);
    render();
});

// ==================== Edit/Delete Widgets ====================
tabContent.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    const widgetId = Number(target.dataset.id);
    if (!widgetId) return;
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    if (target.classList.contains('delete-widget')) {
        if (confirm('Delete this widget?')) {
            await deleteWidget(widgetId);
        }
    } else if (target.classList.contains('edit-widget')) {
        editWidget(widget);
    }
});

function editWidget(w) {
    if (w.type === 'note') {
        showModal('Edit Note', `
            <input id="modal-note-title" value="${escapeHTML(w.title || '')}">
            <textarea id="modal-note-content">${escapeHTML(w.content || '')}</textarea>
        `, async () => {
            w.title = document.getElementById('modal-note-title').value;
            w.content = document.getElementById('modal-note-content').value;
            await saveWidget(w);
        });
    } else if (w.type === 'code') {
        showModal('Edit Code', `
            <input id="modal-code-title" value="${escapeHTML(w.title || '')}">
            <textarea id="modal-code-content">${escapeHTML(w.code || '')}</textarea>
            <select id="modal-code-lang">
                <option ${w.language==='javascript'?'selected':''}>javascript</option>
                <option ${w.language==='python'?'selected':''}>python</option>
                <option ${w.language==='html'?'selected':''}>html</option>
                <option ${w.language==='css'?'selected':''}>css</option>
            </select>
        `, async () => {
            w.title = document.getElementById('modal-code-title').value;
            w.code = document.getElementById('modal-code-content').value;
            w.language = document.getElementById('modal-code-lang').value;
            await saveWidget(w);
        });
    } else if (w.type === 'link') {
        showModal('Edit Link', `
            <input id="modal-link-url" value="${escapeHTML(w.url || '')}">
            <input id="modal-link-title" value="${escapeHTML(w.title || '')}">
        `, async () => {
            w.url = document.getElementById('modal-link-url').value;
            w.title = document.getElementById('modal-link-title').value;
            await saveWidget(w);
        });
    } else if (w.type === 'sticky') {
        showModal('Edit Sticky', `
            <textarea id="modal-sticky-text">${escapeHTML(w.text || '')}</textarea>
            <input id="modal-sticky-color" type="color" value="${escapeHTML(w.color || '#2a5f3a')}">
        `, async () => {
            w.text = document.getElementById('modal-sticky-text').value;
            w.color = document.getElementById('modal-sticky-color').value;
            await saveWidget(w);
        });
    }
}

// ==================== Export/Import ====================
function exportData() {
    const data = JSON.stringify(widgets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `softplace-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            // Clear existing and add all
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            await store.clear();
            for (let w of imported) {
                delete w.id; // let autoincrement assign new ids
                store.add(w);
            }
            await loadWidgets();
            render();
            alert('Import successful');
        } catch (err) {
            alert('Invalid backup file');
        }
    };
    reader.readAsText(file);
}

// ==================== GitHub Gist Sync (Stub) ====================
async function syncWithGist() {
    // This would require GitHub token. For now, just a placeholder.
    alert('GitHub Gist sync not implemented yet. You can manually export/import.');
}

// ==================== Settings Modal (with export/import) ====================
cmdButton.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showSettings();
});

function showSettings() {
    showModal('Settings', `
        <div class="settings-group">
            <button id="export-btn">Export Backup</button>
            <button id="import-btn">Import Backup</button>
        </div>
        <div class="github-sync">
            <button id="gist-sync">Sync with GitHub Gist (beta)</button>
        </div>
    `, () => {});
    // Attach listeners after modal opens
    document.getElementById('export-btn').addEventListener('click', () => {
        exportData();
        modalOverlay.classList.add('hidden');
    });
    document.getElementById('import-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            importData(e.target.files[0]);
            modalOverlay.classList.add('hidden');
        };
        input.click();
    });
    document.getElementById('gist-sync').addEventListener('click', () => {
        syncWithGist();
        modalOverlay.classList.add('hidden');
    });
}

// ==================== Initialize ====================
window.onload = async () => {
    await initDB();
    await loadWidgets();
    renderTabs();
    render();

    // Service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }
};
