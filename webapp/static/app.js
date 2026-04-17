/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * KEYSTROKE DYNAMICS AUTHENTICATION SYSTEM — Frontend Application
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Enhanced JavaScript client that captures keystroke timing data and
 * communicates with the Flask backend for authentication.
 * 
 * Key Features:
 * - Precise keystroke timing capture (press/release events)
 * - Live typing speed indicator with animated feedback
 * - Registration with 5 typing samples
 * - Login with match percentage display
 * - Retry mechanism visualization
 * - Confetti animation on successful auth
 * 
 * Keystroke Features Captured (mirrors original Java KeyDataStore logic):
 * - Hold Time (H): releaseTime - pressTime
 * - Down-Down Time (DD): nextPressTime - currentPressTime
 * - Up-Down Time (UD): nextPressTime - currentReleaseTime
 */

const API_BASE = '';
const REQUIRED_SAMPLES = 5;

// ─── State ──────────────────────────────────────────────────────────────────────
let loginTimings = [];
let loginLastKeyTime = 0;

let regSamples = [];
let currentSampleTimings = [];
let currentSampleIndex = 0;
let regPassword = '';

let loginAttemptsFailed = 0;

// ─── Tab Switching ──────────────────────────────────────────────────────────────

function switchTab(tab) {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('tabRegister').classList.remove('active');

    if (tab === 'login') {
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('tabLogin').classList.add('active');
        resetLoginState();
    } else {
        document.getElementById('registerPage').classList.add('active');
        document.getElementById('tabRegister').classList.add('active');
        resetRegistrationState();
    }
}

// ─── Login Logic ────────────────────────────────────────────────────────────────

function resetLoginState() {
    loginTimings = [];
    loginLastKeyTime = 0;
    document.getElementById('loginResult').classList.remove('visible', 'success', 'failure', 'blocked');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginSpeedBar').style.width = '0%';
    document.getElementById('loginSpeedLabel').textContent = 'Ready';
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').innerHTML = '🔓 Authenticate';
}

// Attach event listeners for login password
document.getElementById('loginPassword').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') return;
    
    const now = performance.now();
    loginTimings.push({
        key: e.key,
        pressTime: now,
        releaseTime: null
    });
    
    // Live feedback
    updateTypingFeedback('login', now);
    animateTypingDots('login');
});

document.getElementById('loginPassword').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') return;
    
    const now = performance.now();
    // Find the last timing entry for this key that doesn't have a release time
    for (let i = loginTimings.length - 1; i >= 0; i--) {
        if (loginTimings[i].key === e.key && loginTimings[i].releaseTime === null) {
            loginTimings[i].releaseTime = now;
            break;
        }
    }
});

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    if (!username || !password) {
        showNotification('Please enter both username and password.', 'warning');
        return;
    }

    if (loginTimings.length < 3) {
        showNotification('Please type your password (at least 3 characters detected).', 'warning');
        return;
    }

    // Ensure all timings have release times
    const validTimings = loginTimings.filter(t => t.releaseTime !== null);
    if (validTimings.length < 3) {
        showNotification('Could not capture enough typing data. Please try again.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Verifying...';

    try {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password,
                timings: validTimings
            })
        });

        const data = await response.json();
        displayLoginResult(data);

    } catch (err) {
        showNotification('Connection error. Is the server running?', 'error');
        console.error(err);
    }

    btn.disabled = false;
    btn.innerHTML = '🔓 Authenticate';
    
    // Reset timings for next attempt
    loginTimings = [];
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginSpeedBar').style.width = '0%';
    document.getElementById('loginSpeedLabel').textContent = 'Ready';
}

function displayLoginResult(data) {
    const container = document.getElementById('loginResult');
    const icon = document.getElementById('loginResultIcon');
    const title = document.getElementById('loginResultTitle');
    const message = document.getElementById('loginResultMessage');
    const matchDisplay = document.getElementById('matchDisplay');

    container.classList.remove('success', 'failure', 'blocked');

    if (data.blocked) {
        container.classList.add('visible', 'blocked');
        icon.textContent = '🚫';
        title.textContent = 'Account Blocked';
        message.textContent = data.message;
        matchDisplay.style.display = 'none';
        updateAttemptsIndicator(0);
        document.getElementById('authCard').classList.add('shake');
        setTimeout(() => document.getElementById('authCard').classList.remove('shake'), 600);
        return;
    }

    if (data.success && data.genuine) {
        container.classList.add('visible', 'success');
        icon.textContent = '✅';
        title.textContent = 'Access Granted';
        message.textContent = data.message;
        matchDisplay.style.display = 'flex';

        animatePercentageRing(data.match_percentage, true);
        document.getElementById('detailDistance').textContent = data.distance;
        document.getElementById('detailThreshold').textContent = data.threshold;
        document.getElementById('detailVerdict').textContent = data.verdict;
        document.getElementById('attemptsIndicator').style.display = 'none';

        loginAttemptsFailed = 0;
        triggerConfetti();

    } else {
        container.classList.add('visible', 'failure');
        icon.textContent = '❌';
        title.textContent = data.verdict || 'Authentication Failed';
        message.textContent = data.message;

        if (data.match_percentage !== undefined) {
            matchDisplay.style.display = 'flex';
            animatePercentageRing(data.match_percentage, false);
            document.getElementById('detailDistance').textContent = data.distance;
            document.getElementById('detailThreshold').textContent = data.threshold;
            document.getElementById('detailVerdict').textContent = data.verdict || 'Rejected';
        } else {
            matchDisplay.style.display = 'none';
        }

        if (data.attempts_remaining !== undefined) {
            updateAttemptsIndicator(data.attempts_remaining);
        }

        document.getElementById('authCard').classList.add('shake');
        setTimeout(() => document.getElementById('authCard').classList.remove('shake'), 600);
    }
}

function animatePercentageRing(percentage, isSuccess) {
    const ring = document.getElementById('percentageRing');
    const fill = document.getElementById('ringFill');
    const value = document.getElementById('percentageValue');
    
    ring.classList.remove('success', 'failure');
    ring.classList.add(isSuccess ? 'success' : 'failure');

    const circumference = 2 * Math.PI * 40; // r=40
    const offset = circumference - (percentage / 100) * circumference;

    // Delay for animation effect
    setTimeout(() => {
        fill.style.strokeDashoffset = offset;
    }, 100);

    // Animate counter
    let current = 0;
    const target = Math.round(percentage);
    const step = target / 40;
    const interval = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(interval);
        }
        value.textContent = Math.round(current) + '%';
    }, 30);
}

function updateAttemptsIndicator(remaining) {
    const indicator = document.getElementById('attemptsIndicator');
    indicator.style.display = 'flex';
    
    const used = 3 - remaining;
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`attemptDot${i}`);
        dot.classList.remove('used', 'remaining');
        if (i <= used) {
            dot.classList.add('used');
        } else {
            dot.classList.add('remaining');
        }
    }

    document.getElementById('attemptsText').textContent = 
        remaining > 0 ? `${remaining} attempt${remaining > 1 ? 's' : ''} left` : 'Blocked';
}

// ─── Registration Logic ─────────────────────────────────────────────────────────

function resetRegistrationState() {
    regSamples = [];
    currentSampleTimings = [];
    currentSampleIndex = 0;
    regPassword = '';

    document.getElementById('regUsername').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('sampleCounter').style.display = 'none';
    document.getElementById('sampleInputGroup').style.display = 'none';
    document.getElementById('sampleStatusLabel').style.display = 'none';
    document.getElementById('regStartBtn').style.display = 'block';
    document.getElementById('regSubmitBtn').style.display = 'none';
    document.getElementById('regInstructions').style.display = 'block';
    document.getElementById('regResult').classList.remove('visible', 'success', 'failure');

    document.getElementById('regSpeedBar').style.width = '0%';
    document.getElementById('regSpeedLabel').textContent = 'Ready';

    // Reset sample dots
    for (let i = 1; i <= 5; i++) {
        const dot = document.getElementById(`sampleDot${i}`);
        dot.classList.remove('completed', 'current');
        if (i === 1) dot.classList.add('current');
    }
}

function startRegistration() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!username) {
        showNotification('Please enter a username.', 'warning');
        return;
    }
    if (!password || password.length < 4) {
        showNotification('Password must be at least 4 characters.', 'warning');
        return;
    }

    regPassword = password;
    regSamples = [];
    currentSampleIndex = 0;
    currentSampleTimings = [];

    // Show sample collection UI
    document.getElementById('regStartBtn').style.display = 'none';
    document.getElementById('regInstructions').style.display = 'none';
    document.getElementById('sampleCounter').style.display = 'flex';
    document.getElementById('sampleStatusLabel').style.display = 'block';
    document.getElementById('sampleInputGroup').style.display = 'block';

    // Disable username and password fields during sampling
    document.getElementById('regUsername').disabled = true;
    document.getElementById('regPassword').disabled = true;

    updateSampleUI();
    document.getElementById('sampleInput').focus();

    showNotification(`Type "${password}" and press Enter — Sample 1 of ${REQUIRED_SAMPLES}`, 'info');
}

function updateSampleUI() {
    for (let i = 1; i <= REQUIRED_SAMPLES; i++) {
        const dot = document.getElementById(`sampleDot${i}`);
        dot.classList.remove('completed', 'current');
        
        if (i <= currentSampleIndex) {
            dot.classList.add('completed');
            dot.textContent = '✓';
        } else if (i === currentSampleIndex + 1) {
            dot.classList.add('current');
            dot.textContent = i;
        } else {
            dot.textContent = i;
        }
    }

    document.getElementById('sampleStatusLabel').textContent = 
        currentSampleIndex >= REQUIRED_SAMPLES 
            ? 'All samples collected! Click Complete Registration.' 
            : `Sample ${currentSampleIndex + 1} of ${REQUIRED_SAMPLES} — Type your password and press Enter`;
}

// Sample input event listeners
const sampleInput = document.getElementById('sampleInput');

sampleInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        collectSample();
        return;
    }

    const now = performance.now();
    currentSampleTimings.push({
        key: e.key,
        pressTime: now,
        releaseTime: null
    });

    updateTypingFeedback('reg', now);
    animateTypingDots('reg');
});

sampleInput.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') return;

    const now = performance.now();
    for (let i = currentSampleTimings.length - 1; i >= 0; i--) {
        if (currentSampleTimings[i].key === e.key && currentSampleTimings[i].releaseTime === null) {
            currentSampleTimings[i].releaseTime = now;
            break;
        }
    }
});

function collectSample() {
    const typedPassword = sampleInput.value;

    if (typedPassword !== regPassword) {
        showNotification('Password doesn\'t match. Please type the exact password.', 'error');
        sampleInput.value = '';
        currentSampleTimings = [];
        sampleInput.classList.add('shake');
        setTimeout(() => sampleInput.classList.remove('shake'), 500);
        return;
    }

    const validTimings = currentSampleTimings.filter(t => t.releaseTime !== null);
    if (validTimings.length < 3) {
        showNotification('Not enough typing data captured. Please type more naturally.', 'warning');
        sampleInput.value = '';
        currentSampleTimings = [];
        return;
    }

    regSamples.push(validTimings);
    currentSampleIndex++;
    currentSampleTimings = [];
    sampleInput.value = '';

    document.getElementById('regSpeedBar').style.width = '0%';
    document.getElementById('regSpeedLabel').textContent = 'Ready';

    updateSampleUI();

    if (currentSampleIndex >= REQUIRED_SAMPLES) {
        document.getElementById('sampleInputGroup').style.display = 'none';
        document.getElementById('regSubmitBtn').style.display = 'block';
        document.getElementById('regSubmitBtn').disabled = false;
        showNotification('All 5 samples collected! Click Complete Registration.', 'success');
    } else {
        showNotification(`Sample ${currentSampleIndex} recorded. ${REQUIRED_SAMPLES - currentSampleIndex} remaining.`, 'info');
        sampleInput.focus();
    }
}

async function submitRegistration() {
    const username = document.getElementById('regUsername').value.trim();
    const password = regPassword;
    const btn = document.getElementById('regSubmitBtn');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Registering...';

    try {
        const response = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password,
                samples: regSamples
            })
        });

        const data = await response.json();
        const container = document.getElementById('regResult');
        const icon = document.getElementById('regResultIcon');
        const title = document.getElementById('regResultTitle');
        const message = document.getElementById('regResultMessage');

        container.classList.remove('success', 'failure');

        if (data.success) {
            container.classList.add('visible', 'success');
            icon.textContent = '🎉';
            title.textContent = 'Registration Successful!';
            message.textContent = data.message + ' You can now sign in with your credentials.';
            triggerConfetti();

            // Re-enable fields
            document.getElementById('regUsername').disabled = false;
            document.getElementById('regPassword').disabled = false;

            // Auto-switch to login after 3s
            setTimeout(() => switchTab('login'), 3000);
        } else {
            container.classList.add('visible', 'failure');
            icon.textContent = '❌';
            title.textContent = 'Registration Failed';
            message.textContent = data.message;
        }

    } catch (err) {
        showNotification('Connection error. Is the server running?', 'error');
        console.error(err);
    }

    btn.innerHTML = '✅ Complete Registration';
    btn.disabled = false;
}

// ─── Live Typing Feedback ───────────────────────────────────────────────────────

let lastKeyTimes = { login: [], reg: [] };

function updateTypingFeedback(context, now) {
    const times = lastKeyTimes[context];
    times.push(now);

    // Keep last 10 keystrokes for speed calculation
    if (times.length > 10) times.shift();

    if (times.length < 2) return;

    // Calculate average interval (ms) over recent keystrokes
    let totalInterval = 0;
    for (let i = 1; i < times.length; i++) {
        totalInterval += times[i] - times[i - 1];
    }
    const avgInterval = totalInterval / (times.length - 1);

    // Convert to characters per minute (CPM)
    const cpm = Math.round((60000 / avgInterval));
    // Convert to WPM (5 chars per word)
    const wpm = Math.round(cpm / 5);

    // Update speed bar (normalize — typical typing 30-120 WPM)
    const barPercent = Math.min(100, Math.max(5, (wpm / 120) * 100));

    const barId = context === 'login' ? 'loginSpeedBar' : 'regSpeedBar';
    const labelId = context === 'login' ? 'loginSpeedLabel' : 'regSpeedLabel';
    const indicatorId = context === 'login' ? 'loginTypingIndicator' : 'regTypingIndicator';

    document.getElementById(barId).style.width = barPercent + '%';
    document.getElementById(labelId).textContent = `${wpm} WPM`;
    document.getElementById(indicatorId).classList.add('active');

    // Change bar color based on speed
    const bar = document.getElementById(barId);
    if (wpm < 30) {
        bar.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
    } else if (wpm < 60) {
        bar.style.background = 'linear-gradient(135deg, #10b981, #00d4ff)';
    } else {
        bar.style.background = 'linear-gradient(135deg, #00d4ff, #7c3aed)';
    }
}

function animateTypingDots(context) {
    const prefix = context === 'login' ? 'login' : 'reg';
    const dots = [
        document.getElementById(`${prefix}Dot1`),
        document.getElementById(`${prefix}Dot2`),
        document.getElementById(`${prefix}Dot3`)
    ];

    // Cycle through dots
    const activeDotIndex = Math.floor(performance.now() / 200) % 3;
    dots.forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === activeDotIndex) {
            dot.classList.add('active');
        }
    });
}

// ─── Notifications ──────────────────────────────────────────────────────────────

let notificationQueue = [];

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => {
        n.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => n.remove(), 300);
    });

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

// ─── Confetti Effect ────────────────────────────────────────────────────────────

function triggerConfetti() {
    const overlay = document.getElementById('confettiOverlay');
    const colors = ['#00d4ff', '#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
        piece.style.animationDelay = (Math.random() * 0.5) + 's';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.width = (Math.random() * 6 + 4) + 'px';
        piece.style.height = (Math.random() * 6 + 4) + 'px';
        overlay.appendChild(piece);
    }

    setTimeout(() => {
        overlay.innerHTML = '';
    }, 4000);
}

// ─── Utility: Handle Enter key on login ─────────────────────────────────────────

document.getElementById('loginPassword').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
    }
});

document.getElementById('loginUsername').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('loginPassword').focus();
    }
});

// ─── Initialize ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
    // Reset percentage ring
    const fill = document.getElementById('ringFill');
    const circumference = 2 * Math.PI * 40;
    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = circumference;

    console.log('%c🔐 KeyAuth — Keystroke Dynamics Authentication System', 
        'color: #00d4ff; font-size: 14px; font-weight: bold;');
    console.log('%cEnhanced with Euclidean Distance Algorithm', 
        'color: #7c3aed; font-size: 11px;');
});
