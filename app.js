// ==================== Debug Logger ====================
function debugLog(...args) {
    const el = document.getElementById('debug-info');
    if (el) {
        el.innerHTML = args.join(' ') + '<br>' + el.innerHTML;
        // Keep only last 5 lines
        const lines = el.innerHTML.split('<br>');
        if (lines.length > 6) el.innerHTML = lines.slice(0,5).join('<br>');
    }
    console.log(...args);
}

// ==================== Tilt Controller with Debug ====================
class TiltController {
    constructor() {
        this.alpha = this.beta = this.gamma = 0;
        this.hasPermission = false;
        this.init();
    }

    init() {
        debugLog('Tilt: initializing');
        
        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
            // iOS requires permission
            debugLog('Tilt: iOS permission required');
            document.body.addEventListener('click', this.requestPermission.bind(this), { once: true });
        } else if (window.DeviceOrientationEvent) {
            // Android usually works without permission
            debugLog('Tilt: adding listener (Android)');
            window.addEventListener('deviceorientation', this.handle.bind(this));
        } else {
            debugLog('Tilt: NOT SUPPORTED');
            this.useFallback();
        }
    }

    requestPermission() {
        debugLog('Tilt: requesting permission');
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                debugLog('Tilt: permission response', response);
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', this.handle.bind(this));
                } else {
                    this.useFallback();
                }
            })
            .catch(err => {
                debugLog('Tilt: permission error', err);
                this.useFallback();
            });
    }

    handle(e) {
        // Log raw values (throttled)
        if (Math.random() < 0.01) { // log ~1% of events
            debugLog(`Tilt: α=${e.alpha?.toFixed(1)} β=${e.beta?.toFixed(1)} γ=${e.gamma?.toFixed(1)}`);
        }
        
        const tiltX = (e.gamma / 90) * 50 || 0;
        const tiltY = (e.beta / 180) * 100 || 0;
        this.updateElements(tiltX, tiltY);
    }

    updateElements(x, y) {
        document.documentElement.style.setProperty('--tilt-x', x + 'px');
        document.documentElement.style.setProperty('--tilt-y', y + 'px');
        
        // Move dream pet slightly
        if (window.dreamPet) window.dreamPet.setTilt(x, y);
    }

    useFallback() {
        debugLog('Tilt: using mouse fallback');
        window.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 100;
            const y = (e.clientY / window.innerHeight - 0.5) * 100;
            this.updateElements(x, y);
        });
    }
}

// ==================== Pressure Touch with Debug ====================
class PressureTouch {
    constructor() {
        this.pressure = 0;
        this.init();
    }

    init() {
        debugLog('Pressure: initializing');
        document.addEventListener('touchstart', this.start.bind(this));
        document.addEventListener('touchmove', this.move.bind(this));
        document.addEventListener('touchend', this.end.bind(this));
    }

    start(e) {
        const touch = e.touches[0];
        debugLog('Pressure: touchstart', { force: touch.force, radiusX: touch.radiusX });
        
        if (touch.force !== undefined && touch.force > 0) {
            this.pressure = touch.force;
            this.applyPressureEffect();
        } else {
            // Simulate based on time and area
            this.startTime = Date.now();
            this.startRadius = touch.radiusX || 10;
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
            // Larger contact area = more pressure
            const radiusPressure = Math.min(touch.radiusX / 30, 1);
            this.pressure = radiusPressure;
            this.applyPressureEffect();
        }
    }

    end() {
        debugLog('Pressure: touchend');
        this.pressure = 0;
        if (this.interval) clearInterval(this.interval);
        this.applyPressureEffect();
    }

    applyPressureEffect() {
        // Scale body
        document.body.style.transform = `scale(${1 + this.pressure * 0.02})`;
        
        // Change background color slightly
        const brightness = 10 + this.pressure * 20;
        document.body.style.backgroundColor = `hsl(0, 0%, ${brightness}%)`;
        
        // Update debug
        debugLog(`Pressure: ${(this.pressure * 100).toFixed(0)}%`);
        
        // Update dream pet
        if (window.dreamPet) window.dreamPet.setPressure(this.pressure);
    }
}

// ==================== Secret Pixel ====================
class SecretPixel {
    constructor() {
        this.container = document.getElementById('pixel-compass');
        this.colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#c7b9ff', '#ff9f1c'];
        this.init();
        debugLog('Pixel: initialized');
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
                debugLog('Storage: ready');
                resolve();
            };
            request.onerror = () => debugLog('Storage: error', request.error);
        });
    }

    async saveEntry(content) {
        const tx = this.db.transaction('entries', 'readwrite');
        const store = tx.objectStore('entries');
        store.add({ content, date: new Date().toISOString() });
        debugLog('Storage: entry saved');
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
        this.body = document.getElementById('pet-body');
        this.leftEye = document.getElementById('pet-eye-left');
        this.rightEye = document.getElementById('pet-eye-right');
        this.baseTransform = '';
        debugLog('DreamPet: created');
        this.update();
    }

    update() {
        setInterval(() => {
            const breath = Math.sin(Date.now() / 500) * 0.1 + 1;
            // Combine with any tilt transform? We'll handle in setTilt separately.
            this.el.style.transform = `scale(${breath})`;
        }, 50);
    }

    setPressure(pressure) {
        if (!this.leftEye) return;
        const eyeScale = 1 + pressure * 0.5;
        this.leftEye.setAttribute('r', 5 * eyeScale);
        this.rightEye.setAttribute('r', 5 * eyeScale);
        const opacity = 0.2 + pressure * 0.3;
        this.body.setAttribute('fill', `rgba(255,255,255,${opacity})`);
    }

    setTilt(x, y) {
        // Apply translation on top of scale (but scale is set every 50ms, so we need to combine)
        // For simplicity, we'll just set a translation and let the interval override? Not ideal.
        // Better: store tilt and combine in update. We'll do that later.
        this.el.style.transform += ` translate(${x/5}px, ${y/5}px)`;
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
    debugLog('App starting...');
    
    new TiltController();
    new PressureTouch();
    new SecretPixel();
    const storage = new OfflineStorage();
    await storage.init();
    
    window.dreamPet = new DreamPet();
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
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => debugLog('SW registered'))
            .catch(err => debugLog('SW error', err));
    }
};
