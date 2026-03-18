import { state } from '../core/state.js';
import { deleteWidget } from '../core/storage.js';
import { showModal } from './Modal.js';
import { showUndo } from './UndoToast.js';

export function Card(widget) {
    const card = document.createElement('div');
    card.className = `card size-${widget.size || 'medium'}`;
    card.dataset.id = widget.id;
    card.dataset.type = widget.type;

    // Header
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `<span>${widget.type}</span><span>${new Date(widget.createdAt).toLocaleDateString()}</span>`;
    card.appendChild(header);

    // Title
    if (widget.title) {
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = widget.title;
        card.appendChild(title);
    }

    // Content preview
    const content = document.createElement('div');
    content.className = 'card-content';
    renderContent(content, widget);
    card.appendChild(content);

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    // Size toggles (S/M/L)
    ['S','M','L'].forEach(sz => {
        const btn = document.createElement('button');
        btn.textContent = sz;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            widget.size = sz.toLowerCase();
            card.className = `card size-${widget.size}`;
            // Persist size change
            import('../core/storage.js').then(({ saveWidget }) => saveWidget(widget));
        });
        footer.appendChild(btn);
    });

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '✎';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editWidget(widget);
    });
    footer.appendChild(editBtn);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteWidget(widget.id);
        showUndo('Widget deleted', async () => {
            // Undo: re-save
            await (await import('../core/storage.js')).saveWidget(widget);
            state.widgets = await (await import('../core/storage.js')).getAllWidgets();
        });
        state.widgets = await (await import('../core/storage.js')).getAllWidgets();
    });
    footer.appendChild(delBtn);

    card.appendChild(footer);

    // Long press for selection mode
    let pressTimer;
    card.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            state.selectionMode = true;
            state.selectedIds.add(widget.id);
            state._notify();
        }, 500);
    });
    card.addEventListener('touchend', () => clearTimeout(pressTimer));
    card.addEventListener('touchmove', () => clearTimeout(pressTimer));

    // Double-click/tap for inline edit (same as edit modal for now)
    card.addEventListener('dblclick', () => editWidget(widget));

    return card;
}

function renderContent(container, widget) {
    if (widget.type === 'code') {
        const pre = document.createElement('pre');
        pre.className = 'widget-code';
        const code = document.createElement('code');
        code.textContent = widget.code?.substring(0, 150) + (widget.code?.length > 150 ? '…' : '');
        pre.appendChild(code);
        container.appendChild(pre);
        // Add copy button inside content for convenience
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋';
        copyBtn.style.marginTop = '8px';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(widget.code || '');
            copyBtn.textContent = '✅';
            setTimeout(() => copyBtn.textContent = '📋', 1000);
        });
        container.appendChild(copyBtn);
    } else if (widget.type === 'link') {
        const a = document.createElement('a');
        a.href = widget.url;
        a.target = '_blank';
        a.className = 'widget-link';
        a.textContent = widget.title || widget.url;
        container.appendChild(a);
        // Optionally show favicon if we had it
    } else if (widget.type === 'sticky') {
        container.style.backgroundColor = widget.color || '#2a2f33';
        container.style.padding = '12px';
        container.style.borderRadius = '12px';
        container.textContent = widget.text?.substring(0, 100) + (widget.text?.length > 100 ? '…' : '');
    } else {
        // Note
        container.textContent = widget.content?.substring(0, 100) + (widget.content?.length > 100 ? '…' : '');
    }
}

function editWidget(widget) {
    import('./Modal.js').then(m => m.Modal.showEditModal(widget));
}
