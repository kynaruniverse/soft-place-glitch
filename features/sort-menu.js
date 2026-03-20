/**
 * MAKÉ FEATURES — sort-menu.js
 * Floating sort popup anchored near the burger button.
 */

import { state } from '../core/state.js';

export function showSortMenuAt(left, top) {
  document.getElementById('sort-menu')?.remove();

  const menu = document.createElement('div');
  menu.id = 'sort-menu';
  menu.className = 'sort-menu-popup';
  menu.style.top  = `${top}px`;
  menu.style.left = `${Math.max(8, left)}px`;

  const fields = [
    { field: 'updatedAt', label: 'Date modified' },
    { field: 'createdAt', label: 'Date created'  },
    { field: 'title',     label: 'Title'          },
  ];

  menu.innerHTML = `
    <div class="sort-menu-section-label">Sort by</div>
    ${fields.map(f => `
      <button class="sort-menu-item ${state.sortField === f.field ? 'active' : ''}"
              data-sort="${f.field}">
        <span>${f.label}</span>
        ${state.sortField === f.field
          ? `<span class="sort-dir-indicator">${state.sortDir === 'desc' ? '↓' : '↑'}</span>`
          : ''}
      </button>
    `).join('')}
  `;

  document.body.appendChild(menu);

  const dismiss = e => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', dismiss);
    }
  };
  // Defer so the click that opened the menu doesn't immediately dismiss it.
  setTimeout(() => document.addEventListener('click', dismiss), 50);

  menu.querySelectorAll('.sort-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.sort;
      if (f === state.sortField) {
        state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        state.sortField = f;
        state.sortDir   = 'desc';
      }
      menu.remove();
    });
  });
}
