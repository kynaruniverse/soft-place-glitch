import { parseCommand } from '../core/commandParser.js';

let palette, input, results;

export const CommandPalette = {
    init() {
        palette = document.createElement('div');
        palette.className = 'command-palette';
        palette.id = 'command-palette';
        palette.innerHTML = `
            <input type="text" id="command-input" placeholder="Type a command...">
            <div id="command-results" class="command-results"></div>
        `;
        document.body.appendChild(palette);

        input = document.getElementById('command-input');
        results = document.getElementById('command-results');

        input.addEventListener('input', () => this.handleInput());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
            if (e.key === 'Enter') this.execute();
        });

        // Hide on click outside
        document.addEventListener('click', (e) => {
            if (!palette.contains(e.target) && e.target.id !== 'cmd-button') {
                this.hide();
            }
        });
    },

    toggle() {
        if (palette.classList.contains('visible')) {
            this.hide();
        } else {
            this.show();
        }
    },

    show() {
        palette.classList.add('visible');
        input.focus();
        input.value = '';
        results.innerHTML = '';
    },

    hide() {
        palette.classList.remove('visible');
    },

    handleInput() {
        const text = input.value.trim();
        if (!text) {
            results.innerHTML = '';
            return;
        }
        // Show suggestions
        const suggestions = [];
        if (text.startsWith('note ')) {
            suggestions.push(`note ${text.slice(5)}`);
        } else if (text.startsWith('code ')) {
            suggestions.push(`code ${text.slice(5)}`);
        } else if (text.startsWith('link ')) {
            suggestions.push(`link ${text.slice(5)}`);
        } else if (text.startsWith('sticky ')) {
            suggestions.push(`sticky ${text.slice(7)}`);
        } else {
            // Search suggestions from state
            import('../core/state.js').then(({ state }) => {
                const matches = state.widgets.filter(w => 
                    (w.title && w.title.toLowerCase().includes(text.toLowerCase())) ||
                    (w.content && w.content.toLowerCase().includes(text.toLowerCase()))
                );
                this.displayResults(matches.map(w => `📄 ${w.title || w.content?.substring(0,30)} (${w.type})`));
            });
            return;
        }
        this.displayResults(suggestions);
    },

    displayResults(items) {
        results.innerHTML = items.map(item => `<div class="command-result-item">${escapeHTML(item)}</div>`).join('');
        Array.from(results.children).forEach((el, i) => {
            el.addEventListener('click', () => {
                input.value = items[i];
                this.execute();
            });
        });
    },

    execute() {
        parseCommand(input.value);
        this.hide();
    },

    showSearchResults(resultsArray) {
        this.show();
        results.innerHTML = resultsArray.map(w => 
            `<div class="command-result-item">📄 ${w.title || w.content?.substring(0,30) || w.url} (${w.type})</div>`
        ).join('');
        // Click to navigate to widget? For now just show.
    }
};

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function(m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m];
    });
}
