// ==================== Tilt Controller ====================
class TiltController {
    constructor() {
        this.alpha = this.beta = this.gamma = 0;
        this.init();
    }

    init() {
        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
            document.body.addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission()
                    .then(res => {
                        if (res === 'granted') window.addEventListener('deviceorientation', this.handle.bind(this));
                    });
            }, { once: true });
        } else if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', this.handle.bind(this));
        } else {
            window.addEventListener('mousemove', (e) => {
                const x = (e.clientX / window.innerWidth - 0.5) * 2;
                const y = (e.clientY / window.innerHeight - 0.5) * 2;
                this.updateElements(x * 50, y * 50);
            });
        }
    }

    handle(e) {
        const tiltX = (e.gamma / 90) * 50;
        const tiltY = (e.beta / 180) * 100;
        this.updateElements(tiltX, tiltY);
    }

    updateElements(x, y) {
        document.documentElement.style.setProperty('--tilt-x', x + 'px');
        document.documentElement.style.setProperty('--tilt-y', y + 'px');
        const pet = document.getElementById('dream-pet');
        if (pet) pet.style.transform = `translate(${x/5}px, ${y/5}px)`;
    }
}

// ==================== Pressure Touch ====================
class PressureTouch {
    constructor() {
        this.pressure = 0;
        this.init();
    }

    init() {
        document.addEventListener('touchstart', this.start.bind(this));
        document.addEventListener('touchmove', this.move.bind(this));
        document.addEventListener('touchend', this.end.bind(this));
    }

    start(e) {
        const touch = e.touches[0];
        if (touch.force !== undefined) {
            this.pressure = touch.force;
        } else {
            this.startTime = Date.now();
            this.interval = setInterval(() => {
                const duration = Date.now() - this.startTime;
                this.pressure = Math.min(duration / 500, 1);
                this.applyPressureEffect();
            }, 50);
        }
    }

    move(e) {
        const touch = e.touches[0];
        if (touch.radiusX) {
            this.pressure = Math.min(touch.radiusX / 30, 1);
            this.applyPressureEffect();
        }
    }

    end() {
        this.pressure = 0;
        if (this.interval) clearInterval(this.interval);
        document.body.style.transform = '';
    }

    applyPressureEffect() {
        document.body.style.transform = `scale(${1 + this.pressure * 0.02})`;
        const pet = document.getElementById('dream-pet');
        if (pet) pet.style.opacity = 0.5 + this.pressure * 0.5;
    }
}

// ==================== Secret Pixel ====================
class SecretPixel {
    constructor() {
        this.container = document.getElementById('pixel-compass');
        this.colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#c7b9ff', '#ff9f1c'];
        this.init();
    }

    init() {
        this.createPixel();
        setInterval(() => this.createPixel(), 30000);
    }

    createPixel() {
        this.container.innerHTML = '';
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 1px;
            height: 1px;
            background: ${this.colors[Math.floor(Math.random() * this.colors.length)]};
            position: absolute;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            transition: all 0.5s ease;
            box-shadow: 0 0 2px currentColor;
        `;
        this.container.appendChild(dot);
    }
}

// ==================== Offline Storage ====================
class OfflineStorage {
    constructor() {
        this.dbName = 'SoftPlace';
        this.init();
    }

    init() {
        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('entries')) {
                    db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
        });
    }

    async saveEntry(content) {
        const tx = this.db.transaction('entries', 'readwrite');
        const store = tx.objectStore('entries');
        store.add({ content, date: new Date().toISOString() });
    }

    async getEntries() {
        return new Promise((resolve) => {
            const tx = this.db.transaction('entries', 'readonly');
            const store = tx.objectStore('entries');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });
    }
}

// ==================== Dream Pet ====================
class DreamPet {
    constructor() {
        this.el = document.getElementById('dream-pet');
        this.update();
    }

    update() {
        setInterval(() => {
            const breath = Math.sin(Date.now() / 500) * 0.1 + 1;
            this.el.style.transform = `scale(${breath})`;
        }, 50);
    }
}

// ==================== Maze (Error State) ====================
class Maze {
    constructor() {
        this.overlay = document.getElementById('maze-overlay');
        this.initListeners();
    }

    initListeners() {
        window.addEventListener('error', () => this.show());
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && !e.target.href) {
                e.preventDefault();
                this.show();
            }
        });
    }

    show() {
        this.overlay.style.display = 'block';
        this.overlay.innerHTML = '<div style="color:white; text-align:center; margin-top:50vh;">🌀 lost? tap to return</div>';
        this.overlay.onclick = () => this.hide();
    }

    hide() {
        this.overlay.style.display = 'none';
    }
}

// ==================== Initialize Everything ====================
window.onload = async () => {
    new TiltController();
    new PressureTouch();
    new SecretPixel();
    const storage = new OfflineStorage();
    await storage.init();
    new DreamPet();
    new Maze();

    document.getElementById('save-entry').addEventListener('click', async () => {
        const text = document.getElementById('entry').value;
        if (text.trim()) {
            await storage.saveEntry(text);
            document.getElementById('entry').value = '';
            alert('saved softly 💭');
        }
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }
};
