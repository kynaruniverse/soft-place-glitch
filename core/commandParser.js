import { state } from './state.js';
import { saveWidget } from './storage.js';
import { showModal } from '../components/Modal.js';

export function parseCommand(input) {
    input = input.trim();
    if (!input) return;

    const parts = input.split(' ');
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    switch (cmd) {
        case 'note':
            createNote(rest);
            break;
        case 'code':
            createCode(rest);
            break;
        case 'link':
            createLink(rest);
            break;
        case 'sticky':
            createSticky(rest);
            break;
        default:
            search(input);
    }
}

function createNote(title) {
    showModal('New Note', `
        <input id="modal-note-title" placeholder="Title" value="${escapeHTML(title)}">
        <textarea id="modal-note-content" placeholder="Note content (Markdown supported)"></textarea>
    `, async () => {
        const t = document.getElementById('modal-note-title').value;
        const c = document.getElementById('modal-note-content').value;
        if (t || c) {
            const widget = { 
                type: 'note', 
                title: t, 
                content: c, 
                size: 'medium',
                createdAt: Date.now() 
            };
            await saveWidget(widget);
            state.widgets = await (await import('./storage.js')).getAllWidgets();
        }
    });
}

function createCode(title) {
    showModal('New Code', `
        <input id="modal-code-title" placeholder="Title" value="${escapeHTML(title)}">
        <textarea id="modal-code-content" placeholder="Paste your code here"></textarea>
        <select id="modal-code-lang">
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="other">Other</option>
        </select>
    `, async () => {
        const t = document.getElementById('modal-code-title').value;
        const c = document.getElementById('modal-code-content').value;
        const l = document.getElementById('modal-code-lang').value;
        if (t || c) {
            const widget = { 
                type: 'code', 
                title: t, 
                code: c, 
                language: l,
                size: 'medium',
                createdAt: Date.now() 
            };
            await saveWidget(widget);
            state.widgets = await (await import('./storage.js')).getAllWidgets();
        }
    });
}

function createLink(url) {
    showModal('New Link', `
        <input id="modal-link-url" placeholder="URL (e.g. https://...)" value="${escapeHTML(url)}">
        <input id="modal-link-title" placeholder="Title (optional)">
        <div id="link-preview" style="margin-top:8px; font-size:12px; color:#a0a8b0;"></div>
    `, async () => {
        const u = document.getElementById('modal-link-url').value;
        let t = document.getElementById('modal-link-title').value;
        if (!u) return;
        // Auto‑fetch if title empty
        if (!t) {
            t = await fetchTitle(u);
        }
        const widget = { 
            type: 'link', 
            url: u, 
            title: t, 
            size: 'medium',
            createdAt: Date.now() 
        };
        await saveWidget(widget);
        state.widgets = await (await import('./storage.js')).getAllWidgets();
    });

    // Live preview while typing (simple)
    const urlInput = document.getElementById('modal-link-url');
    urlInput.addEventListener('input', async () => {
        const preview = document.getElementById('link-preview');
        const val = urlInput.value.trim();
        if (val) {
            preview.innerHTML = '⏳ Fetching...';
            const title = await fetchTitle(val);
            preview.innerHTML = title ? `🖼️ ${title}` : '🔗 No preview available';
        } else {
            preview.innerHTML = '';
        }
    });
}

async function fetchTitle(url) {
    try {
        const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxy);
        const data = await res.json();
        const html = data.contents;
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return match ? match[1] : url;
    } catch {
        return url;
    }
}

function createSticky(text) {
    showModal('New Sticky', `
        <textarea id="modal-sticky-text" placeholder="Sticky note">${escapeHTML(text)}</textarea>
        <input id="modal-sticky-color" type="color" value="#2a5f3a">
        <div style="margin-top:8px; background:#14181c; padding:8px; border-radius:8px;" id="sticky-preview">Preview</div>
    `, async () => {
        const txt = document.getElementById('modal-sticky-text').value;
        const col = document.getElementById('modal-sticky-color').value;
        if (txt) {
            const widget = { 
                type: 'sticky', 
                text: txt, 
                color: col, 
                size: 'medium',
                createdAt: Date.now() 
            };
            await saveWidget(widget);
            state.widgets = await (await import('./storage.js')).getAllWidgets();
        }
    });

    // Live color preview
    const colorInput = document.getElementById('modal-sticky-color');
    const preview = document.getElementById('sticky-preview');
    colorInput.addEventListener('input', () => {
        preview.style.backgroundColor = colorInput.value;
    });
}

function search(query) {
    // Simple search: title and content/code/url
    const results = state.widgets.filter(w => {
        const searchable = [
            w.title,
            w.content,
            w.code,
            w.url,
            w.text
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(query.toLowerCase());
    });
    import('../components/CommandPalette.js').then(m => m.showSearchResults(results));
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function(m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m];
    });
}
