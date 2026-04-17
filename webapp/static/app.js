/* ═══════════════════════════════════════════════════════════════════════════════
   Keystroke Dynamics Authentication — Frontend Logic
   Warm / Handcrafted edition
   ═══════════════════════════════════════════════════════════════════════════════
   Handles:
   • Page navigation with gentle transitions
   • Keystroke timing capture (keydown/keyup)
   • Registration flow (multi-step, 5 samples)
   • Login flow with animated match gauge
   • Toast notifications & overlays
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─── Configuration ──────────────────────────────────────────────────────────────
const API_BASE = '';
const REQUIRED_SAMPLES = 5;

// ─── State ──────────────────────────────────────────────────────────────────────
let currentPage = 'landing';

// Registration state
let regUsername = '';
let regPassword = '';
let regSamples = [];
let regCurrentSample = 0;
let regCurrentTimings = [];

// Login state
let loginTimings = [];

// Debounce timers for typing visuals
let typingTimers = {};


// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function navigateTo(page) {
    if (page === currentPage) return;

    const current = document.getElementById(`page-${currentPage}`);
    const target = document.getElementById(`page-${page}`);
    if (!target) return;

    if (current) current.classList.remove('active');

    setTimeout(() => {
        target.classList.add('active');
        currentPage = page;

        if (page === 'register') resetRegistration();
        if (page === 'login') resetLogin();
        if (page === 'landing') loadStats();
    }, 80);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = {
        success: '✓',
        error: '✗',
        info: '·',
        warning: '!'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || '·'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 250);
    }, duration);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  OVERLAYS
// ═══════════════════════════════════════════════════════════════════════════════

function showOverlay(type, title, message) {
    const overlay = document.getElementById(`overlay-${type}`);
    document.getElementById(`${type}-title`).textContent = title;
    document.getElementById(`${type}-message`).textContent = message;
    overlay.classList.add('active');
}

function closeOverlay(type) {
    document.getElementById(`overlay-${type}`).classList.remove('active');
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TYPING FEEDBACK INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function activateFeedback(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function deactivateFeedback(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

function handleTypingVisual(inputEl, feedbackId) {
    // Add warm typing class to the field container
    const field = inputEl.closest('.field');
    if (field) field.classList.add('typing');

    activateFeedback(feedbackId);

    const feedback = document.getElementById(feedbackId);
    if (feedback) {
        const label = feedback.querySelector('.feedback-label');
        if (label) label.textContent = 'recording keystrokes…';
    }

    clearTimeout(typingTimers[feedbackId]);
    typingTimers[feedbackId] = setTimeout(() => {
        if (field) field.classList.remove('typing');
        deactivateFeedback(feedbackId);
    }, 1000);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  KEYSTROKE TIMING CAPTURE
// ═══════════════════════════════════════════════════════════════════════════════

function createKeystrokeCapture(inputEl, timingsArray, feedbackId) {
    const keyPressMap = {};

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' || e.key === 'Enter') return;
        if (!keyPressMap[e.key]) {
            keyPressMap[e.key] = performance.now();
        }
        handleTypingVisual(inputEl, feedbackId);
    });

    inputEl.addEventListener('keyup', (e) => {
        if (e.key === 'Tab' || e.key === 'Enter') return;
        if (keyPressMap[e.key]) {
            timingsArray.push({
                key: e.key,
                pressTime: keyPressMap[e.key],
                releaseTime: performance.now()
            });
            delete keyPressMap[e.key];
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  LANDING STATS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/api/stats`);
        if (!res.ok) return;
        const data = await res.json();

        animateCounter('stat-users', data.total_users || 0);
        document.getElementById('stat-threshold').textContent =
            `${((1 - data.threshold) * 100).toFixed(0)}%`;
        document.getElementById('stat-samples').textContent = data.required_samples || 5;
    } catch (err) {
        console.warn('Stats unavailable:', err);
    }
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 25));
    const interval = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(interval);
        }
        el.textContent = current;
    }, 35);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

function resetLogin() {
    loginTimings = [];
    document.getElementById('login-form').reset();
    document.getElementById('login-results').style.display = 'none';

    const btn = document.getElementById('btn-login');
    btn.classList.remove('loading');
    btn.disabled = false;

    deactivateFeedback('login-typing-feedback');
}

// Set up keystroke capture on the login password field
document.addEventListener('DOMContentLoaded', () => {
    const loginPwd = document.getElementById('login-password');
    createKeystrokeCapture(loginPwd, loginTimings, 'login-typing-feedback');

    // Visual-only feedback on username field
    const loginUser = document.getElementById('login-username');
    loginUser.addEventListener('keydown', () => {
        handleTypingVisual(loginUser, 'login-typing-feedback');
    });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showToast('Please fill in all fields.', 'warning');
        return;
    }

    if (loginTimings.length < 2) {
        showToast('Not enough keystroke data. Please re-type your password.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-login');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, timings: loginTimings })
        });

        const data = await res.json();

        // Show results panel
        const panel = document.getElementById('login-results');
        panel.style.display = 'flex';

        const matchPct = data.match_percentage || 0;
        animateGauge(matchPct, data.success);

        // Fill details
        document.getElementById('metric-match').textContent = `${matchPct}%`;
        document.getElementById('metric-distance').textContent =
            data.distance != null ? data.distance : '—';
        document.getElementById('metric-verdict').textContent =
            data.verdict || (data.success ? 'Genuine User' : 'Failed');
        document.getElementById('metric-attempts').textContent =
            data.attempts_remaining != null ? data.attempts_remaining : '∞';

        // Color verdict
        const verdict = document.getElementById('metric-verdict');
        verdict.style.color = data.success ? 'var(--sage)' : 'var(--terracotta)';

        if (data.success) {
            showOverlay('success', 'Access granted',
                `Welcome back! Your typing pattern matched at ${matchPct}%.`);
        } else if (data.blocked) {
            showOverlay('error', 'Account blocked',
                data.message || 'Too many failed attempts. Contact an administrator.');
        } else {
            showToast(data.message || 'Authentication failed.', 'error');
            const card = document.querySelector('.surface-card');
            if (card) {
                card.classList.add('shake');
                setTimeout(() => card.classList.remove('shake'), 450);
            }
        }

    } catch (err) {
        showToast('Connection error — is the server running?', 'error');
        console.error('Login error:', err);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
        loginTimings.length = 0;
    }
});

function animateGauge(percentage, isSuccess) {
    const circle = document.getElementById('match-circle');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (percentage / 100) * circumference;

    circle.classList.remove('success', 'failure');
    circle.classList.add(isSuccess ? 'success' : 'failure');
    circle.style.strokeDashoffset = circumference; // reset

    const valueEl = document.getElementById('match-pct-value');
    let current = 0;
    const step = Math.max(1, Math.ceil(percentage / 35));
    const interval = setInterval(() => {
        current += step;
        if (current >= percentage) {
            current = percentage;
            clearInterval(interval);
        }
        valueEl.textContent = Math.round(current);
    }, 25);

    requestAnimationFrame(() => {
        setTimeout(() => {
            circle.style.strokeDashoffset = offset;
        }, 80);
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

function resetRegistration() {
    regUsername = '';
    regPassword = '';
    regSamples = [];
    regCurrentSample = 0;
    regCurrentTimings = [];

    const form = document.getElementById('reg-account-form');
    if (form) form.reset();

    updateStepper(0);
    showRegPanel('reg-panel-0');

    document.querySelectorAll('.stamp').forEach(s => {
        s.classList.remove('collected', 'current');
    });

    const sampleInput = document.getElementById('reg-sample-input');
    if (sampleInput) sampleInput.value = '';

    deactivateFeedback('reg-typing-feedback');
}

function showRegPanel(id) {
    document.querySelectorAll('.reg-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(id);
    if (panel) panel.classList.add('active');
}

function updateStepper(step) {
    const fill = document.getElementById('stepper-fill');
    const total = 6; // account + 5 samples
    fill.style.width = `${(step / (total - 1)) * 100}%`;

    document.querySelectorAll('.stepper-dot').forEach(d => {
        const s = parseInt(d.dataset.step);
        d.classList.remove('active', 'completed');
        if (s < step) d.classList.add('completed');
        else if (s === step) d.classList.add('active');
    });
}

// Step 0 → Account details
document.getElementById('reg-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    if (!username || !password) {
        showToast('Please fill in all fields.', 'warning');
        return;
    }

    if (password.length < 4) {
        showToast('Password must be at least 4 characters.', 'warning');
        return;
    }

    // Check if username exists
    try {
        const res = await fetch(`${API_BASE}/api/user/exists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (data.exists) {
            showToast('That username is taken. Try another.', 'error');
            return;
        }
    } catch (err) {
        showToast('Connection error — is the server running?', 'error');
        return;
    }

    regUsername = username;
    regPassword = password;
    regCurrentSample = 0;
    regSamples = [];

    updateStepper(1);
    showRegPanel('reg-panel-sample');
    updateSampleUI();
    setupSampleInput();
    showToast('Now type your password 5 times to train the system.', 'info');
});

function setupSampleInput() {
    const input = document.getElementById('reg-sample-input');
    // Replace node to clear old event listeners
    const fresh = input.cloneNode(true);
    input.parentNode.replaceChild(fresh, input);

    regCurrentTimings = [];
    createKeystrokeCapture(fresh, regCurrentTimings, 'reg-typing-feedback');

    fresh.value = '';
    fresh.focus();

    // Enter key submits sample
    fresh.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitSample();
        }
    });
}

function updateSampleUI() {
    document.getElementById('sample-counter').textContent =
        `Sample ${regCurrentSample + 1} of ${REQUIRED_SAMPLES}`;

    document.querySelectorAll('.stamp').forEach((s, i) => {
        s.classList.remove('collected', 'current');
        if (i < regCurrentSample) s.classList.add('collected');
        else if (i === regCurrentSample) s.classList.add('current');
    });
}

function submitSample() {
    const input = document.getElementById('reg-sample-input');
    const typed = input.value;

    if (typed !== regPassword) {
        showToast('Password mismatch — type your exact password.', 'error');
        const card = document.querySelector('.surface-card');
        if (card) {
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 450);
        }
        input.value = '';
        regCurrentTimings = [];
        setupSampleInput();
        return;
    }

    if (regCurrentTimings.length < 2) {
        showToast('Not enough keystrokes captured. Type more carefully.', 'warning');
        input.value = '';
        regCurrentTimings = [];
        setupSampleInput();
        return;
    }

    // Save
    regSamples.push([...regCurrentTimings]);
    regCurrentSample++;

    // Mark stamp as collected
    const stamps = document.querySelectorAll('.stamp');
    if (stamps[regCurrentSample - 1]) {
        stamps[regCurrentSample - 1].classList.add('collected');
        stamps[regCurrentSample - 1].classList.remove('current');
    }

    showToast(`Sample ${regCurrentSample} recorded ✓`, 'success', 2000);

    if (regCurrentSample >= REQUIRED_SAMPLES) {
        submitRegistration();
        return;
    }

    updateStepper(regCurrentSample + 1);
    updateSampleUI();
    setupSampleInput();
}

async function submitRegistration() {
    showRegPanel('reg-panel-loading');
    updateStepper(6);

    try {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: regUsername,
                password: regPassword,
                samples: regSamples
            })
        });

        const data = await res.json();

        // Dramatic pause
        await new Promise(r => setTimeout(r, 1600));

        if (data.success) {
            showOverlay('success', 'Account created!',
                `${data.message} You can now sign in with your unique typing pattern.`);
            setTimeout(() => navigateTo('login'), 400);
        } else {
            showOverlay('error', 'Registration failed', data.message || 'An error occurred.');
            resetRegistration();
        }
    } catch (err) {
        showOverlay('error', 'Connection error', 'Could not reach the server. Please try again.');
        console.error('Registration error:', err);
        resetRegistration();
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    loadStats();

    // Close overlays on backdrop click
    document.querySelectorAll('.overlay').forEach(ov => {
        ov.addEventListener('click', (e) => {
            if (e.target === ov) ov.classList.remove('active');
        });
    });
});
