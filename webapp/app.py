"""
Keystroke Dynamics Authentication System - Flask Backend
=========================================================
Enhanced version using Euclidean Distance algorithm for pattern matching.
Replaces the original IBM Watson ML-based classification approach.

Features:
- User registration with 5 typing samples for consistency
- Authentication using Euclidean Distance comparison
- Match percentage calculation
- 3-attempt retry mechanism with account blocking
- Live typing speed tracking
"""

import os
import json
import math
import time
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)

# ─── Data Storage ───────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
BLOCKED_FILE = os.path.join(DATA_DIR, 'blocked.json')

# ─── Configuration ──────────────────────────────────────────────────────────────
EUCLIDEAN_THRESHOLD = 0.65       # Distance threshold for acceptance
MAX_LOGIN_ATTEMPTS = 3           # Max failed attempts before blocking
REQUIRED_SAMPLES = 5             # Number of registration samples required 
MAX_ACCEPTABLE_DISTANCE = 1.5    # Used for percentage calculation normalization


def ensure_data_dir():
    """Create data directory if it doesn't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            json.dump({}, f)
    if not os.path.exists(BLOCKED_FILE):
        with open(BLOCKED_FILE, 'w') as f:
            json.dump({}, f)


def load_users():
    """Load user data from JSON file."""
    ensure_data_dir()
    with open(USERS_FILE, 'r') as f:
        return json.load(f)


def save_users(users):
    """Save user data to JSON file."""
    ensure_data_dir()
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)


def load_blocked():
    """Load blocked users data."""
    ensure_data_dir()
    with open(BLOCKED_FILE, 'r') as f:
        return json.load(f)


def save_blocked(blocked):
    """Save blocked users data."""
    ensure_data_dir()
    with open(BLOCKED_FILE, 'w') as f:
        json.dump(blocked, f, indent=2)


# ─── Core Algorithm: Euclidean Distance ─────────────────────────────────────────

def compute_keystroke_features(timings):
    """
    Compute keystroke features from raw key timing data.
    
    Extracts three timing features per consecutive key pair:
    - Hold Time (H): duration a key is pressed (release - press)
    - Down-Down Time (DD): interval between pressing consecutive keys
    - Up-Down Time (UD): interval between releasing one key and pressing the next
    
    This mirrors the original Java KeyDataStore.process() logic.
    
    Args:
        timings: List of dicts with 'pressTime' and 'releaseTime' (in ms)
    
    Returns:
        List of float features (in seconds)
    """
    if len(timings) < 2:
        return []

    features = []
    for i in range(len(timings) - 1):
        current = timings[i]
        next_key = timings[i + 1]

        hold_time = (current['releaseTime'] - current['pressTime']) / 1000.0
        dd_time = (next_key['pressTime'] - current['pressTime']) / 1000.0
        ud_time = (next_key['pressTime'] - current['releaseTime']) / 1000.0

        features.extend([hold_time, dd_time, ud_time])

    # Add the hold time of the last key
    last = timings[-1]
    last_hold = (last['releaseTime'] - last['pressTime']) / 1000.0
    features.append(last_hold)

    return features


def euclidean_distance(pattern_a, pattern_b):
    """
    Calculate the Euclidean Distance between two typing patterns.
    
    Formula: d = sqrt( Σ (a_i - b_i)² )
    
    This is the core algorithm replacement for the original IBM Watson ML model.
    The Euclidean distance measures how "far apart" two typing patterns are
    in multi-dimensional feature space.
    
    Args:
        pattern_a: Reference pattern (stored during registration)
        pattern_b: Test pattern (captured during login)
    
    Returns:
        float: The Euclidean distance value
    """
    if len(pattern_a) != len(pattern_b):
        # Pad the shorter pattern or truncate the longer one
        min_len = min(len(pattern_a), len(pattern_b))
        pattern_a = pattern_a[:min_len]
        pattern_b = pattern_b[:min_len]

    a = np.array(pattern_a)
    b = np.array(pattern_b)
    distance = np.sqrt(np.sum((a - b) ** 2))
    return float(distance)


def calculate_match_percentage(distance):
    """
    Convert Euclidean distance to a match percentage.
    
    Uses an exponential decay function for more intuitive percentage mapping:
    - Distance 0 → 100% match
    - Small distances → high percentages (genuine user)
    - Large distances → low percentages (imposter)
    
    Args:
        distance: Euclidean distance value
    
    Returns:
        float: Match percentage (0-100)
    """
    percentage = max(0, (1 - (distance / MAX_ACCEPTABLE_DISTANCE)) * 100)
    return round(min(100, percentage), 2)


def compute_average_pattern(samples):
    """
    Compute the average typing pattern from multiple registration samples.
    
    This implements the typing consistency feature — by collecting 5 samples
    and averaging them, we get a more reliable reference pattern that 
    reduces the effect of individual typing variations.
    
    Args:
        samples: List of feature lists (each from one typing sample)
    
    Returns:
        List of float: The averaged pattern
    """
    if not samples:
        return []

    # Find minimum length across all samples
    min_len = min(len(s) for s in samples)
    trimmed = [s[:min_len] for s in samples]

    avg = np.mean(trimmed, axis=0)
    return avg.tolist()


# ─── API Routes ─────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """Serve the main HTML page."""
    return send_from_directory('static', 'index.html')


@app.route('/api/register', methods=['POST'])
def register():
    """
    Register a new user with keystroke patterns.
    
    Expects JSON:
    {
        "username": "string",
        "password": "string",
        "samples": [
            [{"pressTime": ms, "releaseTime": ms}, ...],  // sample 1
            ...  // 5 samples total
        ]
    }
    
    Process:
    1. Validate username doesn't exist
    2. Verify 5 samples are provided
    3. Compute features for each sample
    4. Average features into a reference pattern
    5. Store user data
    """
    data = request.get_json()
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()
    samples = data.get('samples', [])

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required.'}), 400

    if len(password) < 4:
        return jsonify({'success': False, 'message': 'Password must be at least 4 characters.'}), 400

    users = load_users()

    if username in users:
        return jsonify({'success': False, 'message': 'Username already exists.'}), 409

    if len(samples) < REQUIRED_SAMPLES:
        return jsonify({
            'success': False,
            'message': f'At least {REQUIRED_SAMPLES} typing samples are required. You provided {len(samples)}.'
        }), 400

    # Compute features for each sample
    feature_sets = []
    for sample in samples:
        features = compute_keystroke_features(sample)
        if features:
            feature_sets.append(features)

    if len(feature_sets) < REQUIRED_SAMPLES:
        return jsonify({
            'success': False,
            'message': 'Some samples were invalid. Please try again.'
        }), 400

    # Average the patterns for consistency
    avg_pattern = compute_average_pattern(feature_sets)

    # Store user data
    users[username] = {
        'password': password,
        'pattern': avg_pattern,
        'sample_count': len(feature_sets),
        'registered_at': time.time()
    }
    save_users(users)

    # Clear any previous blocks
    blocked = load_blocked()
    if username in blocked:
        del blocked[username]
        save_blocked(blocked)

    return jsonify({
        'success': True,
        'message': f'Registration successful! {len(feature_sets)} samples recorded.',
        'sample_count': len(feature_sets)
    })


@app.route('/api/login', methods=['POST'])
def login():
    """
    Authenticate a user using Euclidean Distance on keystroke patterns.
    
    Expects JSON:
    {
        "username": "string",
        "password": "string",
        "timings": [{"pressTime": ms, "releaseTime": ms}, ...]
    }
    
    Algorithm:
    1. Verify password matches
    2. Compute features from login keystroke timings
    3. Calculate Euclidean Distance against stored pattern
    4. If distance < threshold → Accept (Genuine)
    5. Else → Reject (Imposter)
    6. Track failed attempts; block after 3 failures
    """
    data = request.get_json()
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()
    timings = data.get('timings', [])

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required.'}), 400

    # Check if user is blocked
    blocked = load_blocked()
    if username in blocked:
        block_info = blocked[username]
        if block_info.get('attempts', 0) >= MAX_LOGIN_ATTEMPTS:
            return jsonify({
                'success': False,
                'blocked': True,
                'message': f'Account is blocked after {MAX_LOGIN_ATTEMPTS} failed attempts. Contact administrator.',
                'attempts_remaining': 0
            }), 403

    users = load_users()

    if username not in users:
        return jsonify({'success': False, 'message': 'User not found. Please register first.'}), 404

    user = users[username]

    # Step 1: Verify password
    if user['password'] != password:
        # Increment failed attempt counter
        if username not in blocked:
            blocked[username] = {'attempts': 0}
        blocked[username]['attempts'] = blocked[username].get('attempts', 0) + 1
        remaining = MAX_LOGIN_ATTEMPTS - blocked[username]['attempts']
        save_blocked(blocked)

        if remaining <= 0:
            return jsonify({
                'success': False,
                'blocked': True,
                'message': f'Account blocked after {MAX_LOGIN_ATTEMPTS} failed attempts.',
                'attempts_remaining': 0
            }), 403

        return jsonify({
            'success': False,
            'message': f'Incorrect password. {remaining} attempt(s) remaining.',
            'attempts_remaining': remaining
        }), 401

    # Step 2: Compute keystroke features from login attempt
    login_features = compute_keystroke_features(timings)

    if not login_features:
        return jsonify({
            'success': False,
            'message': 'Could not extract typing pattern. Please type more naturally.'
        }), 400

    # Step 3: Calculate Euclidean Distance
    stored_pattern = user['pattern']
    distance = euclidean_distance(stored_pattern, login_features)

    # Step 4: Calculate match percentage
    match_percentage = calculate_match_percentage(distance)

    # Step 5: Accept or Reject
    if distance < EUCLIDEAN_THRESHOLD:
        # ACCEPT — genuine user
        # Reset failed attempts on successful login
        if username in blocked:
            del blocked[username]
            save_blocked(blocked)

        return jsonify({
            'success': True,
            'genuine': True,
            'message': 'Authentication successful! Typing pattern verified.',
            'match_percentage': match_percentage,
            'distance': round(distance, 4),
            'threshold': EUCLIDEAN_THRESHOLD,
            'verdict': 'Genuine User'
        })
    else:
        # REJECT — imposter or inconsistent typing
        if username not in blocked:
            blocked[username] = {'attempts': 0}
        blocked[username]['attempts'] = blocked[username].get('attempts', 0) + 1
        remaining = MAX_LOGIN_ATTEMPTS - blocked[username]['attempts']
        save_blocked(blocked)

        if remaining <= 0:
            return jsonify({
                'success': False,
                'genuine': False,
                'blocked': True,
                'message': f'Account blocked after {MAX_LOGIN_ATTEMPTS} failed attempts.',
                'match_percentage': match_percentage,
                'distance': round(distance, 4),
                'threshold': EUCLIDEAN_THRESHOLD,
                'verdict': 'Imposter Detected',
                'attempts_remaining': 0
            }), 403

        return jsonify({
            'success': False,
            'genuine': False,
            'message': f'Typing pattern mismatch. {remaining} attempt(s) remaining.',
            'match_percentage': match_percentage,
            'distance': round(distance, 4),
            'threshold': EUCLIDEAN_THRESHOLD,
            'verdict': 'Imposter Detected',
            'attempts_remaining': remaining
        }), 401


@app.route('/api/unblock', methods=['POST'])
def unblock_user():
    """Admin endpoint to unblock a user."""
    data = request.get_json()
    username = data.get('username', '').strip().lower()

    blocked = load_blocked()
    if username in blocked:
        del blocked[username]
        save_blocked(blocked)
        return jsonify({'success': True, 'message': f'User {username} has been unblocked.'})

    return jsonify({'success': False, 'message': 'User is not blocked.'})


@app.route('/api/user/exists', methods=['POST'])
def check_user():
    """Check if a username exists."""
    data = request.get_json()
    username = data.get('username', '').strip().lower()
    users = load_users()
    return jsonify({'exists': username in users})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics."""
    users = load_users()
    blocked = load_blocked()
    return jsonify({
        'total_users': len(users),
        'blocked_users': len(blocked),
        'threshold': EUCLIDEAN_THRESHOLD,
        'required_samples': REQUIRED_SAMPLES,
        'max_attempts': MAX_LOGIN_ATTEMPTS
    })


# ─── Static File Serving ────────────────────────────────────────────────────────

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files."""
    return send_from_directory('static', path)


if __name__ == '__main__':
    ensure_data_dir()
    print("=" * 60)
    print("  Keystroke Dynamics Authentication System")
    print("  Enhanced with Euclidean Distance Algorithm")
    print("=" * 60)
    print(f"  Threshold: {EUCLIDEAN_THRESHOLD}")
    print(f"  Required Samples: {REQUIRED_SAMPLES}")
    print(f"  Max Login Attempts: {MAX_LOGIN_ATTEMPTS}")
    print("=" * 60)

    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
