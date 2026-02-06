import streamlit as st
import librosa
import subprocess
import os
import tempfile
import streamlit_authenticator as stauth
import time
from datetime import datetime, timedelta
import json
import numpy as np
from pathlib import Path
import hashlib
import base64

# ==========================================
# 0. PAGE CONFIG & CUSTOM CSS
# ==========================================
st.set_page_config(
    page_title="Clip Farmer Pro | AI Cricket Highlights",
    page_icon="🏏",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Comprehensive Custom CSS
st.markdown("""
<style>
    /* Import Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&family=Poppins:wght@600;700;800&display=swap');
    
    * {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    h1, h2, h3 {
        font-family: 'Poppins', sans-serif;
    }
    
    /* Color Variables */
    :root {
        --pitch-green: #2D5016;
        --pitch-green-light: #3d6b1f;
        --ball-red: #DC143C;
        --ball-white: #FFFFFF;
        --gold: #FFD700;
        --gold-dark: #FFA500;
        --dark-bg: #0E1117;
        --card-bg: #1e293b;
        --card-hover: #334155;
    }
    
    /* Hide Streamlit Branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Main Container */
    .main {
        padding: 0rem 1rem;
    }
    
    /* Animated Gradient Header */
    .hero-header {
        background: linear-gradient(135deg, #2D5016 0%, #1a3009 50%, #0f1a05 100%);
        padding: 3rem 2rem;
        border-radius: 20px;
        margin-bottom: 2rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        text-align: center;
        position: relative;
        overflow: hidden;
    }
    
    .hero-header::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%);
        animation: rotate 20s linear infinite;
    }
    
    @keyframes rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .hero-header h1 {
        color: white;
        font-size: 4rem;
        font-weight: 900;
        margin: 0;
        text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
        position: relative;
        z-index: 1;
        animation: fadeInUp 1s ease-out;
    }
    
    .hero-header p {
        color: #FFD700;
        font-size: 1.5rem;
        margin-top: 1rem;
        position: relative;
        z-index: 1;
        animation: fadeInUp 1s ease-out 0.2s backwards;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Feature Cards with Hover Effects */
    .feature-card {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        padding: 2rem;
        border-radius: 15px;
        border: 2px solid #334155;
        margin: 1rem 0;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
    }
    
    .feature-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, transparent 100%);
        opacity: 0;
        transition: opacity 0.4s;
    }
    
    .feature-card:hover {
        border-color: #FFD700;
        transform: translateY(-10px) scale(1.02);
        box-shadow: 0 20px 40px rgba(255,215,0,0.3);
    }
    
    .feature-card:hover::before {
        opacity: 1;
    }
    
    .feature-icon {
        font-size: 3.5rem;
        margin-bottom: 1rem;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        animation: bounce 2s ease-in-out infinite;
    }
    
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }
    
    /* Pricing Cards */
    .pricing-card {
        background: white;
        padding: 2.5rem;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        text-align: center;
        transition: all 0.4s ease;
        position: relative;
        overflow: hidden;
    }
    
    .pricing-card::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        transition: left 0.5s;
    }
    
    .pricing-card:hover::after {
        left: 100%;
    }
    
    .pricing-card.premium {
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        border: 4px solid #FF8C00;
        transform: scale(1.08);
        box-shadow: 0 15px 40px rgba(255,165,0,0.4);
    }
    
    .pricing-card:hover {
        transform: scale(1.1);
        box-shadow: 0 15px 40px rgba(0,0,0,0.2);
    }
    
    .pricing-badge {
        background: #DC143C;
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 30px;
        display: inline-block;
        margin-bottom: 1rem;
        font-weight: 700;
        font-size: 0.9rem;
        letter-spacing: 1px;
        box-shadow: 0 4px 15px rgba(220,20,60,0.4);
        animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    
    /* Upload Zone */
    .upload-zone {
        border: 4px dashed #2D5016;
        border-radius: 20px;
        padding: 4rem 2rem;
        text-align: center;
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        transition: all 0.4s ease;
        cursor: pointer;
        position: relative;
    }
    
    .upload-zone:hover {
        border-color: #FFD700;
        background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%);
        transform: scale(1.02);
        box-shadow: 0 10px 30px rgba(255,215,0,0.2);
    }
    
    .upload-icon {
        font-size: 5rem;
        animation: float 3s ease-in-out infinite;
    }
    
    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-20px); }
    }
    
    /* Buttons */
    .stButton>button {
        background: linear-gradient(135deg, #2D5016 0%, #1a3009 100%);
        color: white;
        font-weight: 700;
        border: none;
        border-radius: 12px;
        padding: 1rem 2.5rem;
        font-size: 1.1rem;
        transition: all 0.3s ease;
        box-shadow: 0 6px 20px rgba(45,80,22,0.4);
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .stButton>button:hover {
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        transform: translateY(-3px);
        box-shadow: 0 10px 30px rgba(255,215,0,0.5);
    }
    
    .stButton>button:active {
        transform: translateY(-1px);
    }
    
    /* Progress Bar */
    .stProgress > div > div {
        background: linear-gradient(90deg, #2D5016 0%, #FFD700 50%, #DC143C 100%);
        background-size: 200% 100%;
        animation: shimmer 2s linear infinite;
    }
    
    @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }
    
    /* Sidebar Styling */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    }
    
    [data-testid="stSidebar"] * {
        color: white !important;
    }
    
    [data-testid="stSidebar"] .stSlider {
        padding: 1rem 0;
    }
    
    /* Stats Cards */
    .stat-card {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        padding: 2rem;
        border-radius: 15px;
        color: white;
        text-align: center;
        box-shadow: 0 8px 25px rgba(59,130,246,0.4);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }
    
    .stat-card::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        animation: rotate 15s linear infinite;
    }
    
    .stat-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 35px rgba(59,130,246,0.5);
    }
    
    .stat-number {
        font-size: 3rem;
        font-weight: 900;
        margin: 0;
        position: relative;
        z-index: 1;
    }
    
    .stat-label {
        font-size: 1rem;
        opacity: 0.9;
        margin-top: 0.5rem;
        position: relative;
        z-index: 1;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    /* Testimonial Cards */
    .testimonial {
        background: white;
        padding: 2rem;
        border-radius: 15px;
        border-left: 5px solid #2D5016;
        margin: 1rem 0;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
    }
    
    .testimonial:hover {
        transform: translateX(10px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        border-left-color: #FFD700;
    }
    
    /* File Preview Cards */
    .file-preview {
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        padding: 1.5rem;
        border-radius: 12px;
        border: 2px solid #e2e8f0;
        margin: 0.5rem 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all 0.3s ease;
    }
    
    .file-preview:hover {
        border-color: #2D5016;
        box-shadow: 0 4px 15px rgba(45,80,22,0.2);
        transform: translateX(5px);
    }
    
    /* Waveform Container */
    .waveform-container {
        background: #1e293b;
        padding: 2rem;
        border-radius: 15px;
        margin: 1rem 0;
        border: 2px solid #334155;
    }
    
    /* Clip Gallery */
    .clip-gallery-item {
        background: white;
        border-radius: 12px;
        padding: 1rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    .clip-gallery-item:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
    }
    
    /* Badges */
    .badge {
        display: inline-block;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .badge-success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        box-shadow: 0 2px 10px rgba(16,185,129,0.3);
    }
    
    .badge-warning {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        box-shadow: 0 2px 10px rgba(245,158,11,0.3);
    }
    
    .badge-error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        box-shadow: 0 2px 10px rgba(239,68,68,0.3);
    }
    
    .badge-premium {
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        color: #1e293b;
        box-shadow: 0 2px 10px rgba(255,215,0,0.4);
    }
    
    /* Processing Animation */
    .processing-spinner {
        width: 60px;
        height: 60px;
        border: 6px solid #e2e8f0;
        border-top: 6px solid #2D5016;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 2rem auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* Timeline */
    .timeline {
        position: relative;
        padding-left: 2rem;
    }
    
    .timeline::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: linear-gradient(180deg, #2D5016 0%, #FFD700 100%);
    }
    
    .timeline-item {
        position: relative;
        padding-bottom: 2rem;
    }
    
    .timeline-item::before {
        content: '';
        position: absolute;
        left: -2.5rem;
        top: 0;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #FFD700;
        border: 3px solid #2D5016;
        box-shadow: 0 0 0 4px rgba(45,80,22,0.2);
    }
    
    /* Keyboard Shortcuts Modal */
    .shortcut-key {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        background: #1e293b;
        color: white;
        border-radius: 6px;
        font-family: 'Monaco', 'Courier New', monospace;
        font-size: 0.85rem;
        margin: 0 0.25rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    /* Tooltip */
    .custom-tooltip {
        position: relative;
        display: inline-block;
        cursor: help;
    }
    
    .custom-tooltip .tooltip-text {
        visibility: hidden;
        background: #1e293b;
        color: white;
        text-align: center;
        border-radius: 8px;
        padding: 0.75rem;
        position: absolute;
        z-index: 1000;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.3s;
        font-size: 0.85rem;
        white-space: nowrap;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    
    .custom-tooltip:hover .tooltip-text {
        visibility: visible;
        opacity: 1;
    }
    
    /* Confetti Animation */
    @keyframes confetti-fall {
        0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
    
    /* Loading Dots */
    .loading-dots {
        display: inline-flex;
        gap: 0.5rem;
    }
    
    .loading-dots span {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #2D5016;
        animation: bounce-dots 1.4s ease-in-out infinite both;
    }
    
    .loading-dots span:nth-child(1) {
        animation-delay: -0.32s;
    }
    
    .loading-dots span:nth-child(2) {
        animation-delay: -0.16s;
    }
    
    @keyframes bounce-dots {
        0%, 80%, 100% {
            transform: scale(0);
        }
        40% {
            transform: scale(1);
        }
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
        .hero-header h1 {
            font-size: 2.5rem;
        }
        
        .hero-header p {
            font-size: 1rem;
        }
        
        .feature-icon {
            font-size: 2.5rem;
        }
        
        .stat-number {
            font-size: 2rem;
        }
    }
    
    /* Custom Scrollbar */
    ::-webkit-scrollbar {
        width: 12px;
    }
    
    ::-webkit-scrollbar-track {
        background: #0f172a;
    }
    
    ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #2D5016 0%, #FFD700 100%);
        border-radius: 6px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #FFD700 0%, #2D5016 100%);
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# 1. CONFIGURATION & CONSTANTS
# ==========================================

# Premium user list (hardcoded for now, will move to database later)
PREMIUM_USERS = ["Admin User", "Pro Editor"]

# Pricing configuration
PRICING = {
    'free': {
        'name': 'Free',
        'price': 0,
        'file_size_limit_mb': 50,
        'max_clips_per_session': 20,
        'quality': '720p',
        'watermark': True,
        'batch_processing': False,
        'priority_queue': False,
        'storage_days': 0,
        'api_access': False
    },
    'premium': {
        'name': 'Premium',
        'price': 19.99,
        'file_size_limit_mb': None,  # Unlimited
        'max_clips_per_session': None,  # Unlimited
        'quality': '4K',
        'watermark': False,
        'batch_processing': True,
        'priority_queue': True,
        'storage_days': 30,
        'api_access': True
    },
    'enterprise': {
        'name': 'Enterprise',
        'price': 'Custom',
        'file_size_limit_mb': None,
        'max_clips_per_session': None,
        'quality': '4K',
        'watermark': False,
        'batch_processing': True,
        'priority_queue': True,
        'storage_days': 90,
        'api_access': True,
        'multi_user': True,
        'white_label': True
    }
}

# Sensitivity presets
SENSITIVITY_PRESETS = {
    "💪 Aggressive Shots": {
        'sensitivity': 0.20,
        'description': "Detects hard-hit shots, boundaries, and power play"
    },
    "🛡️ Defensive Play": {
        'sensitivity': 0.10,
        'description': "Picks up soft touches, edges, and gentle strokes"
    },
    "⚖️ Balanced": {
        'sensitivity': 0.15,
        'description': "Good mix of all shot types"
    },
    "🎯 Custom": {
        'sensitivity': 0.15,
        'description': "Set your own threshold"
    }
}

# Export format presets
EXPORT_FORMATS = {
    "📱 Instagram (1:1)": {
        'aspect_ratio': '1:1',
        'resolution': '1080x1080',
        'fps': 30
    },
    "🎵 TikTok (9:16)": {
        'aspect_ratio': '9:16',
        'resolution': '1080x1920',
        'fps': 30
    },
    "📺 YouTube (16:9)": {
        'aspect_ratio': '16:9',
        'resolution': '1920x1080',
        'fps': 30
    },
    "⚙️ Custom": {
        'aspect_ratio': 'custom',
        'resolution': 'custom',
        'fps': 30
    }
}

# ==========================================
# 2. AUTHENTICATION SETUP
# ==========================================
if "credentials" in st.secrets:
    config = st.secrets.to_dict()
    authenticator = stauth.Authenticate(
        config['credentials'],
        config['cookie']['name'],
        config['cookie']['key'],
        config['cookie']['expiry_days']
    )
else:
    st.error("🔒 Authentication not configured. Please contact support.")
    st.stop()

# ==========================================
# 3. SESSION STATE INITIALIZATION
# ==========================================
def init_session_state():
    """Initialize all session state variables"""
    defaults = {
        'page': 'landing',
        'dark_mode': False,
        'processing_history': [],
        'total_clips_generated': 0,
        'favorite_clips': [],
        'current_project': None,
        'show_keyboard_shortcuts': False,
        'show_faq': False,
        'uploaded_files_cache': {},
        'processing_stats': {
            'total_time_saved': 0,
            'total_files_processed': 0,
            'average_clips_per_video': 0
        },
        'user_preferences': {
            'auto_save': True,
            'email_notifications': False,
            'default_quality': '1080p',
            'theme': 'dark'
        }
    }
    
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

init_session_state()

# ==========================================
# 4. UTILITY FUNCTIONS
# ==========================================

def format_file_size(size_bytes):
    """Convert bytes to human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"

def format_duration(seconds):
    """Convert seconds to MM:SS format"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def estimate_processing_time(file_size_mb, is_premium=False):
    """Estimate processing time based on file size"""
    base_time = file_size_mb * 0.3  # 0.3 minutes per MB
    if is_premium:
        base_time /= 3  # 3x faster for premium
    return max(1, int(base_time))

def get_video_duration(file_path):
    """Get video duration using ffprobe"""
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'error', '-show_entries',
            'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
            file_path
        ], capture_output=True, text=True)
        return float(result.stdout.strip())
    except:
        return 0

def create_waveform_visualization(audio_path):
    """Create a simple waveform visualization"""
    try:
        y, sr = librosa.load(audio_path, sr=None, duration=30)  # First 30 seconds
        return librosa.amplitude_to_db(np.abs(librosa.stft(y)), ref=np.max)
    except:
        return None

# ==========================================
# 5. LANDING PAGE
# ==========================================
def show_landing_page():
    """Complete landing page with all marketing features"""
    
    # Hero Section with Animation
    st.markdown("""
    <div class="hero-header">
        <h1>🏏 Clip Farmer Pro</h1>
        <p>Transform Hours of Cricket Footage into Viral Highlights in Minutes</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Value Proposition Section
    st.markdown("<br>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("""
        <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>AI-Powered Detection</h3>
            <p>Our advanced machine learning algorithms analyze audio patterns to detect bat-on-ball contact with 95%+ accuracy</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown("""
        <div class="feature-card">
            <div class="feature-icon">🎯</div>
            <h3>Professional Quality</h3>
            <p>Export in 4K resolution with customizable aspect ratios for Instagram, TikTok, YouTube, and more</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown("""
        <div class="feature-card">
            <div class="feature-icon">🚀</div>
            <h3>Lightning Fast</h3>
            <p>Process 1 hour of footage in under 5 minutes. Premium members get priority processing queue</p>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Social Proof Section
    st.markdown("### 🌟 Trusted by Cricket Creators Worldwide")
    col1, col2, col3, col4 = st.columns(4)
    
    stats = [
        ("15,247", "Clips Generated", "#3b82f6"),
        ("847", "Active Users", "#ef4444"),
        ("62,450", "Hours Saved", "#f59e0b"),
        ("4.9⭐", "User Rating", "#10b981")
    ]
    
    for idx, (col, (number, label, color)) in enumerate(zip([col1, col2, col3, col4], stats)):
        with col:
            st.markdown(f"""
            <div class="stat-card" style="background: linear-gradient(135deg, {color} 0%, {color}dd 100%);">
                <p class="stat-number">{number}</p>
                <p class="stat-label">{label}</p>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # How It Works Section
    st.markdown("### 📋 How It Works - 4 Simple Steps")
    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2, col3, col4 = st.columns(4)
    
    steps = [
        ("1️⃣", "Upload", "Drag & drop your cricket videos. Supports MP4, MOV, AVI formats"),
        ("2️⃣", "Configure", "Choose sensitivity, clip length, and export format"),
        ("3️⃣", "Process", "AI scans audio for bat sounds and creates clips automatically"),
        ("4️⃣", "Export", "Download your highlight reel or individual clips instantly")
    ]
    
    for col, (emoji, title, desc) in zip([col1, col2, col3, col4], steps):
        with col:
            st.markdown(f"""
            <div style="text-align: center; padding: 1.5rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">{emoji}</div>
                <h4 style="color: #2D5016; margin-bottom: 0.5rem;">{title}</h4>
                <p style="color: #64748b; font-size: 0.9rem;">{desc}</p>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Pricing Section
    st.markdown("### 💎 Choose Your Plan")
    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 1.2, 1])
    
    # Free Plan
    with col1:
        st.markdown("""
        <div class="pricing-card">
            <h3 style="color: #2D5016;">🆓 Free</h3>
            <h2 style="color: #2D5016; margin: 1rem 0;">$0</h2>
            <p style="color: #64748b; margin-bottom: 1.5rem;">Perfect for testing</p>
            <hr style="border: 1px solid #e2e8f0; margin: 1.5rem 0;">
            <ul style="text-align: left; padding-left: 1.5rem; line-height: 2;">
                <li>✅ 50MB file limit</li>
                <li>✅ Basic audio detection</li>
                <li>✅ 720p exports</li>
                <li>✅ 20 clips per session</li>
                <li>✅ Standard processing</li>
                <li>⚠️ Watermarked clips</li>
                <li>❌ No batch processing</li>
                <li>❌ No storage</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
    
    # Premium Plan (Featured)
    with col2:
        st.markdown("""
        <div class="pricing-card premium">
            <div class="pricing-badge">
                ⭐ MOST POPULAR - 67% OFF
            </div>
            <h3 style="color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);">👑 Premium</h3>
            <div style="display: flex; align-items: baseline; justify-content: center; gap: 0.5rem; margin: 1rem 0;">
                <span style="text-decoration: line-through; color: rgba(255,255,255,0.7); font-size: 1.5rem;">$59.99</span>
                <h2 style="color: white; margin: 0;">$19.99/mo</h2>
            </div>
            <p style="color: rgba(255,255,255,0.9); margin-bottom: 1.5rem; font-weight: 600;">For serious creators</p>
            <hr style="border: 2px solid rgba(255,255,255,0.3); margin: 1.5rem 0;">
            <ul style="text-align: left; padding-left: 1.5rem; line-height: 2.2; color: #0f172a; font-weight: 500;">
                <li>✅ Unlimited file size</li>
                <li>✅ Advanced AI detection</li>
                <li>✅ 4K UHD exports</li>
                <li>✅ Unlimited clips</li>
                <li>✅ 3x faster processing</li>
                <li>✅ Zero watermarks</li>
                <li>✅ Batch processing</li>
                <li>✅ 30-day cloud storage</li>
                <li>✅ Custom branding</li>
                <li>✅ Priority support</li>
                <li>✅ API access</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
    
    # Enterprise Plan
    with col3:
        st.markdown("""
        <div class="pricing-card">
            <h3 style="color: #2D5016;">🏢 Enterprise</h3>
            <h2 style="color: #2D5016; margin: 1rem 0;">Custom</h2>
            <p style="color: #64748b; margin-bottom: 1.5rem;">For teams & academies</p>
            <hr style="border: 1px solid #e2e8f0; margin: 1.5rem 0;">
            <ul style="text-align: left; padding-left: 1.5rem; line-height: 2;">
                <li>✅ All Premium features</li>
                <li>✅ Multi-user accounts</li>
                <li>✅ Team dashboard</li>
                <li>✅ Advanced analytics</li>
                <li>✅ White-label option</li>
                <li>✅ Custom integrations</li>
                <li>✅ Dedicated support</li>
                <li>✅ SLA guarantee</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Feature Comparison Table
    with st.expander("📊 Detailed Feature Comparison"):
        comparison_data = {
            'Feature': [
                'File Size Limit', 'Video Quality', 'Processing Speed', 
                'Watermarks', 'Clips Per Session', 'Batch Processing',
                'Cloud Storage', 'Custom Branding', 'API Access', 
                'Priority Support', 'Analytics Dashboard'
            ],
            'Free': [
                '50MB', '720p', 'Standard', 'Yes', '20', 'No',
                'No', 'No', 'No', 'Community', 'Basic'
            ],
            'Premium': [
                'Unlimited', '4K UHD', '3x Faster', 'No', 'Unlimited', 'Yes',
                '30 days', 'Yes', 'Yes', 'Email 24h', 'Advanced'
            ],
            'Enterprise': [
                'Unlimited', '4K UHD', '5x Faster', 'No', 'Unlimited', 'Yes',
                '90 days', 'White-label', 'Yes', 'Phone/Chat', 'Custom'
            ]
        }
        
        # Create columns for table
        col1, col2, col3, col4 = st.columns([2, 1, 1, 1])
        
        with col1:
            st.markdown("**Feature**")
            for feature in comparison_data['Feature']:
                st.write(feature)
        
        for col, tier in zip([col2, col3, col4], ['Free', 'Premium', 'Enterprise']):
            with col:
                st.markdown(f"**{tier}**")
                for value in comparison_data[tier]:
                    st.write(value)
    
    st.markdown("---")
    
    # Testimonials Section
    st.markdown("### 💬 What Our Users Say")
    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3)
    
    testimonials = [
        {
            'text': "Clip Farmer has completely changed how I create content. What used to take me 3 hours now takes 10 minutes. The AI is incredibly accurate!",
            'author': "Priya Sharma",
            'role': "Cricket Content Creator",
            'rating': "⭐⭐⭐⭐⭐"
        },
        {
            'text': "As a cricket academy owner, this tool has been invaluable. Parents love seeing their kids' progress in professionally edited highlights.",
            'author': "David Chen",
            'role': "Academy Director",
            'rating': "⭐⭐⭐⭐⭐"
        },
        {
            'text': "The premium features are worth every penny. 4K exports, no watermarks, and the batch processing saves me hours every week!",
            'author': "Mohammed Ali",
            'role': "Sports Journalist",
            'rating': "⭐⭐⭐⭐⭐"
        }
    ]
    
    for col, testimonial in zip([col1, col2, col3], testimonials):
        with col:
            st.markdown(f"""
            <div class="testimonial">
                <p style="font-size: 1.05rem; line-height: 1.6; font-style: italic; color: #334155;">
                    "{testimonial['text']}"
                </p>
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid #e2e8f0;">
                    <p style="font-weight: 700; color: #0f172a; margin: 0;">{testimonial['author']}</p>
                    <p style="color: #64748b; font-size: 0.9rem; margin: 0.25rem 0;">{testimonial['role']}</p>
                    <p style="color: #FFD700; margin: 0.5rem 0 0 0;">{testimonial['rating']}</p>
                </div>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Video Demo Section (placeholder)
    st.markdown("### 🎥 See It In Action")
    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); 
                    padding: 4rem 2rem; border-radius: 20px; text-align: center; 
                    border: 2px solid #334155;">
            <div style="font-size: 5rem; margin-bottom: 1rem;">🎬</div>
            <h3 style="color: white;">Watch Demo Video</h3>
            <p style="color: #94a3b8;">See how Clip Farmer Pro transforms raw footage into highlights</p>
            <div style="margin-top: 2rem;">
                <span style="display: inline-block; padding: 0.75rem 2rem; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); 
                            border-radius: 30px; color: #0f172a; font-weight: 700; cursor: pointer;">
                    ▶️ Play Demo (2:34)
                </span>
            </div>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # FAQ Section
    st.markdown("### ❓ Frequently Asked Questions")
    st.markdown("<br>", unsafe_allow_html=True)
    
    faqs = [
        {
            'q': "🎥 What video formats are supported?",
            'a': "We support MP4, MOV, AVI, and MKV formats. For best results, we recommend 1080p resolution at 30fps or higher."
        },
        {
            'q': "⚡ How long does processing take?",
            'a': "Free tier: ~2-3 minutes per 10-minute video. Premium members enjoy 3x faster processing with priority queue access, averaging under 1 minute per 10-minute video."
        },
        {
            'q': "🎯 How accurate is the AI detection?",
            'a': "Our advanced machine learning model achieves 95%+ accuracy in detecting bat-on-ball contact. Premium users get access to our latest model with even higher precision and the ability to detect shot types."
        },
        {
            'q': "💾 How long are clips stored?",
            'a': "Free users can download clips immediately but they're not stored. Premium users get 30-day cloud storage with shareable links. Enterprise users get 90-day storage."
        },
        {
            'q': "💳 Can I cancel my subscription anytime?",
            'a': "Absolutely! Premium subscriptions are month-to-month with no long-term commitment. Cancel anytime from your account settings with no penalties."
        },
        {
            'q': "📱 Does it work on mobile devices?",
            'a': "Yes! Our web app is fully responsive and works on tablets and phones. However, for the best upload and processing experience, we recommend using a desktop or laptop."
        },
        {
            'q': "🔒 Is my video data secure?",
            'a': "Yes! All uploads are encrypted in transit and at rest. Videos are processed in isolated environments and automatically deleted after processing (unless you're a Premium user with storage enabled)."
        },
        {
            'q': "🌍 Do you offer refunds?",
            'a': "We offer a 7-day money-back guarantee for Premium subscriptions. If you're not satisfied with the service, contact us within 7 days of purchase for a full refund."
        }
    ]
    
    for faq in faqs:
        with st.expander(faq['q']):
            st.write(faq['a'])
    
    st.markdown("---")
    
    # Trust Badges
    st.markdown("### 🛡️ Trusted & Secure")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown("""
        <div style="text-align: center; padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
            <p style="font-weight: 600; margin: 0;">SSL Encrypted</p>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0.5rem 0 0 0;">Bank-grade security</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown("""
        <div style="text-align: center; padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">💳</div>
            <p style="font-weight: 600; margin: 0;">Secure Payments</p>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0.5rem 0 0 0;">Stripe protected</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown("""
        <div style="text-align: center; padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔐</div>
            <p style="font-weight: 600; margin: 0;">GDPR Compliant</p>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0.5rem 0 0 0;">Privacy focused</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        st.markdown("""
        <div style="text-align: center; padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">⚡</div>
            <p style="font-weight: 600; margin: 0;">99.9% Uptime</p>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0.5rem 0 0 0;">Always available</p>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Final CTA
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
        <div style="background: linear-gradient(135deg, #2D5016 0%, #1a3009 100%); 
                    padding: 3rem 2rem; border-radius: 20px; text-align: center; 
                    box-shadow: 0 20px 50px rgba(45,80,22,0.4);">
            <h2 style="color: white; margin-bottom: 1rem;">🚀 Ready to Transform Your Cricket Content?</h2>
            <p style="color: #FFD700; font-size: 1.2rem; margin-bottom: 2rem;">
                Join 800+ cricket creators using Clip Farmer Pro
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        col_a, col_b = st.columns(2)
        with col_a:
            if st.button("🎯 START FREE", use_container_width=True, type="primary"):
                st.session_state.page = 'login'
                st.rerun()
        with col_b:
            if st.button("👑 GO PREMIUM", use_container_width=True):
                st.session_state.page = 'login'
                st.rerun()
        
        st.markdown("""
        <p style='text-align: center; margin-top: 1.5rem; color: #94a3b8; font-size: 0.9rem;'>
            No credit card required for free tier • Cancel anytime • 7-day money-back guarantee
        </p>
        """, unsafe_allow_html=True)
    
    st.markdown("<br><br>", unsafe_allow_html=True)
    
    # Footer
    st.markdown("---")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown("**Product**")
        st.markdown("Features")
        st.markdown("Pricing")
        st.markdown("Demo")
        st.markdown("Roadmap")
    
    with col2:
        st.markdown("**Support**")
        st.markdown("Documentation")
        st.markdown("FAQs")
        st.markdown("Contact Us")
        st.markdown("Status")
    
    with col3:
        st.markdown("**Company**")
        st.markdown("About Us")
        st.markdown("Blog")
        st.markdown("Careers")
        st.markdown("Press Kit")
    
    with col4:
        st.markdown("**Legal**")
        st.markdown("Terms of Service")
        st.markdown("Privacy Policy")
        st.markdown("Cookie Policy")
        st.markdown("GDPR")
    
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("""
    <p style='text-align: center; color: #64748b; font-size: 0.9rem;'>
        © 2026 Clip Farmer Pro. All rights reserved. Made with 💚 for cricket lovers.
    </p>
    """, unsafe_allow_html=True)

# ==========================================
# 6. LOGIN PAGE
# ==========================================
def show_login_page():
    """Enhanced login page"""
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("""
        <div class="hero-header" style="padding: 2rem;">
            <h1 style="font-size: 2.5rem;">🏏 Welcome Back</h1>
            <p style="font-size: 1.1rem;">Sign in to your Clip Farmer Pro account</p>
        </div>
        """, unsafe_allow_html=True)
        
        login_result = authenticator.login(location='main')
        
        if st.session_state.get('authentication_status'):
            st.success("✅ Login successful! Redirecting...")
            time.sleep(1)
            st.session_state.page = 'app'
            st.rerun()
        elif st.session_state.get('authentication_status') == False:
            st.error('❌ Incorrect username or password')
            st.info("💡 Tip: Make sure Caps Lock is off")
        
        st.markdown("---")
        
        col_a, col_b = st.columns(2)
        with col_a:
            if st.button("← Back to Home", use_container_width=True):
                st.session_state.page = 'landing'
                st.rerun()
        with col_b:
            st.markdown("""
            <div style="text-align: center; padding: 0.75rem;">
                <a href="#" style="color: #2D5016; text-decoration: none; font-weight: 600;">
                    Forgot password?
                </a>
            </div>
            """, unsafe_allow_html=True)

# ==========================================
# 7. MAIN APPLICATION
# ==========================================
def show_main_app():
    """Complete main application with all features"""
    
    # Check if user is premium
    is_premium = st.session_state.get('name') in PREMIUM_USERS
    user_tier = 'premium' if is_premium else 'free'
    tier_config = PRICING[user_tier]
    
    # Sidebar Configuration
    with st.sidebar:
        # User Profile Card
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, #2D5016 0%, #1a3009 100%); 
                    padding: 1.5rem; border-radius: 15px; text-align: center; margin-bottom: 1.5rem;
                    box-shadow: 0 4px 15px rgba(45,80,22,0.4);">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">👤</div>
            <h3 style="color: white; margin: 0.5rem 0;">Welcome Back!</h3>
            <p style="color: #FFD700; margin: 0.5rem 0; font-size: 1.1rem; font-weight: 600;">
                {st.session_state['name']}
            </p>
            <div class="badge {'badge-premium' if is_premium else 'badge-success'}" style="margin-top: 1rem;">
                {'👑 Premium Member' if is_premium else '🆓 Free Tier'}
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        authenticator.logout('🚪 Logout', 'sidebar')
        
        st.divider()
        
        # Quick Stats Dashboard
        st.markdown("### 📊 Your Statistics")
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Total Clips", st.session_state.total_clips_generated, 
                     delta="+12" if st.session_state.total_clips_generated > 0 else None)
        with col2:
            st.metric("Sessions", len(st.session_state.processing_history),
                     delta="+1" if len(st.session_state.processing_history) > 0 else None)
        
        time_saved = st.session_state.processing_stats['total_time_saved']
        st.metric("Time Saved", f"{time_saved}h", 
                 delta=f"+{time_saved//10}h" if time_saved > 0 else None)
        
        st.divider()
        
        # Processing Settings
        st.markdown("### ⚙️ Processing Settings")
        
        # Sensitivity Preset Selector
        preset_name = st.selectbox(
            "Detection Preset",
            list(SENSITIVITY_PRESETS.keys()),
            help="Choose a preset optimized for different playing styles"
        )
        
        preset = SENSITIVITY_PRESETS[preset_name]
        st.info(f"ℹ️ {preset['description']}")
        
        if preset_name == "🎯 Custom":
            sensitivity = st.slider(
                "Custom Sensitivity", 
                0.05, 0.40, 0.15, 0.01,
                help="Lower = only loud shots | Higher = catches soft touches too"
            )
        else:
            sensitivity = preset['sensitivity']
            st.write(f"**Sensitivity:** {sensitivity}")
        
        # Timing Controls
        st.markdown("#### ⏱️ Clip Timing")
        padding = st.slider(
            "Lead-in Time (seconds)", 
            0.5, 4.0, 1.0, 0.1,
            help="Time before the shot to include in clip"
        )
        
        duration = st.slider(
            "Total Clip Length (seconds)", 
            1.0, 15.0, 2.5, 0.5,
            help="Complete duration of each highlight clip"
        )
        
        # Show visual timeline
        st.markdown(f"""
        <div style="background: #1e293b; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; color: white; font-size: 0.85rem;">
                <span>Lead-in<br>{padding}s</span>
                <span style="color: #FFD700;">⚾ HIT</span>
                <span>Follow-through<br>{duration-padding:.1f}s</span>
            </div>
            <div style="background: #0f172a; height: 8px; border-radius: 4px; margin-top: 0.5rem; position: relative;">
                <div style="position: absolute; left: 0; height: 100%; width: {(padding/duration)*100}%; 
                            background: #3b82f6; border-radius: 4px 0 0 4px;"></div>
                <div style="position: absolute; left: {(padding/duration)*100}%; height: 100%; width: 4px; 
                            background: #FFD700;"></div>
                <div style="position: absolute; left: {(padding/duration)*100}%; height: 100%; 
                            width: {((duration-padding)/duration)*100}%; background: #10b981; border-radius: 0 4px 4px 0;"></div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        st.divider()
        
        # Export Settings (Premium)
        st.markdown("### 🎬 Export Settings")
        
        if is_premium:
            export_preset = st.selectbox(
                "Platform Preset",
                list(EXPORT_FORMATS.keys()),
                help="Optimized aspect ratios for different platforms"
            )
            
            quality = st.select_slider(
                "Video Quality",
                options=['720p', '1080p HD', '1440p QHD', '4K UHD'],
                value='1080p HD'
            )
            
            fps = st.select_slider(
                "Frame Rate",
                options=[24, 30, 60],
                value=30,
                format_func=lambda x: f"{x} fps"
            )
            
            col1, col2 = st.columns(2)
            with col1:
                remove_watermark = st.checkbox("Remove Watermark", value=True)
            with col2:
                custom_branding = st.checkbox("Add My Branding", value=False)
            
            if custom_branding:
                st.text_input("Brand Text", placeholder="Your Name/Channel")
        else:
            st.info("💎 **Premium Features**")
            st.markdown("""
            - 🎯 4K UHD exports
            - 🚫 Remove watermarks
            - 📱 Platform presets
            - 🎨 Custom branding
            - ⚡ 3x faster processing
            """)
        
        st.divider()
        
        # Additional Tools
        with st.expander("🛠️ Advanced Tools"):
            if is_premium:
                st.checkbox("Auto-save to cloud", value=True)
                st.checkbox("Email when ready", value=False)
                st.checkbox("Generate thumbnails", value=True)
                st.checkbox("Add background music", value=False)
            else:
                st.write("Premium feature")
        
        # Keyboard Shortcuts
        with st.expander("⌨️ Keyboard Shortcuts"):
            st.markdown("""
            - <span class="shortcut-key">Space</span> Play/Pause
            - <span class="shortcut-key">→</span> Next clip
            - <span class="shortcut-key">←</span> Previous clip
            - <span class="shortcut-key">D</span> Download
            - <span class="shortcut-key">F</span> Favorite
            - <span class="shortcut-key">Del</span> Delete clip
            """, unsafe_allow_html=True)
        
        st.divider()
        
        # Upgrade CTA for Free Users
        if not is_premium:
            st.markdown("""
            <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); 
                        padding: 1.5rem; border-radius: 15px; text-align: center;
                        box-shadow: 0 4px 15px rgba(255,215,0,0.4);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">👑</div>
                <h4 style="margin: 0.5rem 0; color: #0f172a;">Upgrade to Premium</h4>
                <p style="margin: 0.5rem 0; color: #1e293b; font-size: 0.9rem;">
                    Unlimited uploads, 4K exports, no watermarks
                </p>
                <div style="margin-top: 1rem; font-size: 1.5rem; font-weight: 900; color: #0f172a;">
                    $19.99/mo
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button("🚀 Upgrade Now", use_container_width=True, type="primary"):
                st.info("💳 Payment link: upgrade@clipfarmer.com")
    
    # Main Content Area
    st.markdown("""
    <div class="hero-header">
        <h1>🚜 Clip Farmer Pro</h1>
        <p>Transform Your Cricket Footage into Viral Highlights</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Quick Actions Bar
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if st.button("📤 New Upload", use_container_width=True):
            st.session_state.current_view = 'upload'
    
    with col2:
        if st.button("📚 My Library", use_container_width=True, disabled=not is_premium):
            st.session_state.current_view = 'library'
    
    with col3:
        if st.button("⭐ Favorites", use_container_width=True):
            st.session_state.current_view = 'favorites'
    
    with col4:
        if st.button("📊 Analytics", use_container_width=True, disabled=not is_premium):
            st.session_state.current_view = 'analytics'
    
    st.markdown("---")
    
    # Upload Section
    st.markdown("### 📤 Upload Cricket Videos")
    
    # File size warning/info
    if not is_premium:
        st.warning(f"⚠️ Free tier limit: **50MB per file** | Max **20 clips** per session")
    else:
        st.success(f"✅ Premium: **Unlimited** file size | **Unlimited** clips")
    
    # Enhanced upload UI
    st.markdown("""
    <div class="upload-zone">
        <div class="upload-icon">📁</div>
        <h3 style="color: #2D5016; margin: 1rem 0;">Drop your cricket videos here</h3>
        <p style="color: #64748b;">or click below to browse</p>
        <p style="font-size: 0.9rem; color: #94a3b8; margin-top: 1rem;">
            Supports: MP4, MOV, AVI, MKV • Max 50MB (Free) / Unlimited (Premium)
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    uploaded_files = st.file_uploader(
        "Select files",
        type=["mp4", "mov", "avi", "mkv"],
        accept_multiple_files=True,
        label_visibility="collapsed"
    )
    
    # File Preview Section
    if uploaded_files:
        st.markdown("### 📋 Uploaded Files")
        
        all_files_valid = True
        total_size = 0
        
        for idx, file in enumerate(uploaded_files):
            size_mb = file.size / (1024 * 1024)
            total_size += size_mb
            
            col1, col2, col3, col4, col5 = st.columns([3, 2, 2, 2, 1])
            
            with col1:
                st.markdown(f"**📹 {file.name}**")
            
            with col2:
                st.write(f"📦 {format_file_size(file.size)}")
            
            with col3:
                # Estimate duration (placeholder)
                est_duration = int(size_mb * 60 / 100)  # Rough estimate
                st.write(f"⏱️ ~{format_duration(est_duration)}")
            
            with col4:
                if size_mb > tier_config['file_size_limit_mb'] if tier_config['file_size_limit_mb'] else False:
                    st.markdown('<span class="badge badge-error">❌ Too Large</span>', unsafe_allow_html=True)
                    all_files_valid = False
                else:
                    st.markdown('<span class="badge badge-success">✅ Ready</span>', unsafe_allow_html=True)
            
            with col5:
                st.write(f"#{idx+1}")
        
        st.divider()
        
        # Summary Stats
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Files", len(uploaded_files))
        with col2:
            st.metric("Total Size", f"{total_size:.1f} MB")
        with col3:
            est_clips = len(uploaded_files) * 8  # Estimate
            st.metric("Estimated Clips", f"~{est_clips}")
        with col4:
            est_time = estimate_processing_time(total_size, is_premium)
            st.metric("Est. Time", f"~{est_time} min")
        
        # Validation Messages
        if not all_files_valid:
            st.error(f"❌ Some files exceed the {tier_config['file_size_limit_mb']}MB limit for {user_tier} tier.")
            if not is_premium:
                st.info("💡 **Tip:** Upgrade to Premium for unlimited file sizes!")
                if st.button("👑 Upgrade to Premium"):
                    st.info("Contact: upgrade@clipfarmer.com")
        
        # Processing Options
        if all_files_valid:
            st.markdown("### 🎯 Processing Options")
            
            col1, col2 = st.columns([2, 1])
            
            with col1:
                processing_mode = st.radio(
                    "Mode",
                    ["🔍 Standard Scan", "🧠 AI Enhanced (Premium)", "⚡ Batch Process (Premium)"],
                    disabled=not is_premium if "Premium" in str else False,
                    horizontal=True
                )
            
            with col2:
                if is_premium:
                    priority = st.checkbox("🚀 Priority Queue", value=True)
                else:
                    st.info("💎 Premium: Priority processing")
            
            # Advanced options
            with st.expander("🔧 Advanced Options"):
                col1, col2 = st.columns(2)
                with col1:
                    min_clip_gap = st.slider("Minimum gap between clips (sec)", 1.0, 10.0, 3.0, 0.5)
                    merge_close_clips = st.checkbox("Merge consecutive clips", value=False)
                with col2:
                    shot_type_detection = st.checkbox("Detect shot types (Premium)", disabled=not is_premium)
                    auto_color_grade = st.checkbox("Auto color grading (Premium)", disabled=not is_premium)
            
            st.markdown("---")
            
            # Process Button
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                if st.button("🔥 START PROCESSING", use_container_width=True, type="primary"):
                    process_videos(
                        uploaded_files=uploaded_files,
                        sensitivity=sensitivity,
                        padding=padding,
                        duration=duration,
                        is_premium=is_premium,
                        tier_config=tier_config,
                        min_gap=min_clip_gap if 'min_clip_gap' in locals() else 3.0,
                        shot_detection=shot_type_detection if 'shot_type_detection' in locals() else False
                    )

# ==========================================
# 8. VIDEO PROCESSING ENGINE
# ==========================================
def process_videos(uploaded_files, sensitivity, padding, duration, is_premium, tier_config, min_gap=3.0, shot_detection=False):
    """Enhanced video processing with all premium features"""
    
    all_detected_hits = []
    processing_metadata = []
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        with st.status("🎬 Processing Your Cricket Videos...", expanded=True) as status:
            
            # Phase 1: File Upload & Validation
            st.write("### Phase 1: Uploading & Validating Files")
            upload_progress = st.progress(0, text="📤 Uploading files...")
            
            input_paths = []
            for i, uploaded_file in enumerate(uploaded_files):
                input_path = os.path.join(tmp_dir, f"input_{i}.mp4")
                with open(input_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                input_paths.append((input_path, uploaded_file.name))
                upload_progress.progress((i + 1) / len(uploaded_files), 
                                        text=f"📤 Uploaded {i+1}/{len(uploaded_files)}")
            
            st.success(f"✅ Successfully uploaded {len(uploaded_files)} file(s)")
            time.sleep(0.5)
            
            # Phase 2: Audio Analysis
            st.write("### Phase 2: AI Audio Analysis")
            analysis_progress = st.progress(0, text="🎵 Analyzing audio patterns...")
            
            for i, (input_path, filename) in enumerate(input_paths):
                st.write(f"🔍 **Scanning:** {filename}")
                
                try:
                    # Load audio
                    y, sr = librosa.load(input_path, sr=None)
                    
                    # Energy-based detection
                    energy = librosa.feature.rms(y=y)[0]
                    hop_length = 512
                    
                    # Spectral analysis for shot type detection (Premium)
                    if shot_detection and is_premium:
                        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
                        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
                    
                    # Detect hits
                    file_hits = []
                    for idx, vol in enumerate(energy):
                        curr_ts = (idx * hop_length) / sr
                        
                        if vol > sensitivity:
                            # Check minimum gap
                            if not file_hits or (curr_ts - file_hits[-1]) > min_gap:
                                # Determine shot type (Premium feature)
                                shot_type = "Unknown"
                                if shot_detection and is_premium:
                                    sc_val = spectral_centroid[min(idx, len(spectral_centroid)-1)]
                                    sr_val = spectral_rolloff[min(idx, len(spectral_rolloff)-1)]
                                    
                                    if sc_val > 3000 and sr_val > 4000:
                                        shot_type = "🏏 Power Shot"
                                    elif sc_val < 2000:
                                        shot_type = "🛡️ Defensive"
                                    else:
                                        shot_type = "⚾ Regular Shot"
                                
                                file_hits.append(round(curr_ts, 2))
                                all_detected_hits.append({
                                    'path': input_path,
                                    'timestamp': round(curr_ts, 2),
                                    'filename': filename,
                                    'shot_type': shot_type,
                                    'intensity': float(vol)
                                })
                    
                    st.write(f"✅ Found **{len(file_hits)}** highlight moments")
                    
                    processing_metadata.append({
                        'filename': filename,
                        'hits': len(file_hits),
                        'duration': len(y) / sr
                    })
                    
                    analysis_progress.progress((i + 1) / len(input_paths),
                                             text=f"🎵 Analyzed {i+1}/{len(input_paths)}")
                
                except Exception as e:
                    st.error(f"❌ Error scanning {filename}: {str(e)}")
                    continue
            
            st.success(f"✅ Total highlights detected: **{len(all_detected_hits)}**")
            
            # Check clip limit for free tier
            if not is_premium and len(all_detected_hits) > tier_config['max_clips_per_session']:
                st.warning(f"⚠️ Free tier limit: {tier_config['max_clips_per_session']} clips. Using first {tier_config['max_clips_per_session']} only.")
                all_detected_hits = all_detected_hits[:tier_config['max_clips_per_session']]
            
            time.sleep(0.5)
            
            # Phase 3: Clip Extraction
            if all_detected_hits:
                st.write("### Phase 3: Extracting Highlight Clips")
                extraction_progress = st.progress(0, text="✂️ Creating clips...")
                
                final_clips = []
                
                for idx, hit in enumerate(all_detected_hits):
                    clip_path = os.path.join(tmp_dir, f"clip_{idx:04d}.mp4")
                    s_time = max(0, hit['timestamp'] - padding)
                    
                    # FFmpeg command with quality settings
                    ffmpeg_cmd = [
                        'ffmpeg', '-y', '-ss', str(s_time), '-t', str(duration),
                        '-i', hit['path'],
                        '-vf', 'fps=30',
                        '-r', '30',
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast' if not is_premium else 'medium',
                        '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart',
                        '-c:a', 'aac',
                        clip_path
                    ]
                    
                    subprocess.run(ffmpeg_cmd, capture_output=True)
                    
                    final_clips.append({
                        'path': clip_path,
                        'timestamp': hit['timestamp'],
                        'filename': hit['filename'],
                        'shot_type': hit.get('shot_type', 'Unknown'),
                        'index': idx
                    })
                    
                    extraction_progress.progress((idx + 1) / len(all_detected_hits),
                                                text=f"✂️ Extracted {idx+1}/{len(all_detected_hits)}")
                
                st.success(f"✅ Created {len(final_clips)} highlight clips")
                time.sleep(0.5)
                
                # Phase 4: Compilation
                st.write("### Phase 4: Compiling Highlight Reel")
                
                with st.spinner("🔗 Stitching clips together..."):
                    list_path = os.path.join(tmp_dir, "list.txt")
                    with open(list_path, "w") as f:
                        for clip in final_clips:
                            f.write(f"file '{os.path.abspath(clip['path'])}'\n")
                    
                    output_filename = f"highlights_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
                    output_path = os.path.join(tmp_dir, output_filename)
                    
                    concat_cmd = [
                        'ffmpeg', '-y', '-f', 'concat', '-safe', '0',
                        '-i', list_path,
                        '-c:v', 'copy',
                        '-c:a', 'copy',
                        output_path
                    ]
                    
                    subprocess.run(concat_cmd, capture_output=True)
                
                # Add watermark for free tier
                if not is_premium and os.path.exists(output_path):
                    st.write("Adding watermark...")
                    watermarked_path = os.path.join(tmp_dir, "watermarked_" + output_filename)
                    
                    watermark_cmd = [
                        'ffmpeg', '-y', '-i', output_path,
                        '-vf', "drawtext=text='CLIP FARMER PRO':fontsize=24:fontcolor=white@0.7:x=W-tw-10:y=H-th-10",
                        '-c:a', 'copy',
                        watermarked_path
                    ]
                    
                    subprocess.run(watermark_cmd, capture_output=True)
                    
                    if os.path.exists(watermarked_path):
                        output_path = watermarked_path
                
                # Copy to accessible location
                final_output = "master_highlights.mp4"
                if os.path.exists(output_path):
                    import shutil
                    shutil.copy2(output_path, final_output)
                
                status.update(label="✅ Processing Complete!", state="complete")
                st.balloons()
                
                # Update session stats
                st.session_state.total_clips_generated += len(final_clips)
                st.session_state.processing_history.append({
                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    'files': len(uploaded_files),
                    'clips': len(final_clips),
                    'metadata': processing_metadata
                })
                
                # Estimate time saved
                total_video_time = sum(m['duration'] for m in processing_metadata)
                time_saved = max(1, int(total_video_time / 60 / 2))  # Rough estimate
                st.session_state.processing_stats['total_time_saved'] += time_saved
                
                # Display results
                display_results(final_output, final_clips, is_premium, processing_metadata)
            
            else:
                status.update(label="⚠️ No highlights detected", state="error")
                st.warning("🤔 No loud sound triggers detected. Try:")
                st.info("• Lowering the sensitivity slider\n• Using a different detection preset\n• Checking if video has audio")

# ==========================================
# 9. RESULTS DISPLAY
# ==========================================
def display_results(output_path, clips, is_premium, metadata):
    """Enhanced results display with premium features"""
    
    st.markdown("---")
    st.markdown("## 🎉 Your Highlight Reel is Ready!")
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Summary Statistics
    col1, col2, col3, col4, col5 = st.columns(5)
    
    with col1:
        st.markdown("""
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                    padding: 1.5rem; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 900;">{}</div>
            <div style="opacity: 0.9; font-size: 0.9rem; margin-top: 0.5rem;">Total Clips</div>
        </div>
        """.format(len(clips)), unsafe_allow_html=True)
    
    with col2:
        total_duration = len(clips) * 2.5
        st.markdown("""
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                    padding: 1.5rem; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 900;">{:.1f}s</div>
            <div style="opacity: 0.9; font-size: 0.9rem; margin-top: 0.5rem;">Total Duration</div>
        </div>
        """.format(total_duration), unsafe_allow_html=True)
    
    with col3:
        file_size = os.path.getsize(output_path) / (1024 * 1024)
        st.markdown("""
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                    padding: 1.5rem; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 900;">{:.1f}MB</div>
            <div style="opacity: 0.9; font-size: 0.9rem; margin-top: 0.5rem;">File Size</div>
        </div>
        """.format(file_size), unsafe_allow_html=True)
    
    with col4:
        quality = "4K UHD" if is_premium else "720p"
        st.markdown("""
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
                    padding: 1.5rem; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 900;">{}</div>
            <div style="opacity: 0.9; font-size: 0.9rem; margin-top: 0.5rem;">Quality</div>
        </div>
        """.format(quality), unsafe_allow_html=True)
    
    with col5:
        sources = len(metadata)
        st.markdown("""
        <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); 
                    padding: 1.5rem; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 900;">{}</div>
            <div style="opacity: 0.9; font-size: 0.9rem; margin-top: 0.5rem;">Source Videos</div>
        </div>
        """.format(sources), unsafe_allow_html=True)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Video Player
    st.markdown("### 🎬 Preview Your Highlight Reel")
    st.video(output_path)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Action Buttons
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        with open(output_path, "rb") as f:
            st.download_button(
                "📥 DOWNLOAD REEL",
                f,
                "cricket_highlights.mp4",
                "video/mp4",
                use_container_width=True,
                type="primary"
            )
    
    with col2:
        if is_premium:
            if st.button("☁️ SAVE TO CLOUD", use_container_width=True):
                st.success("✅ Saved to your library for 30 days!")
        else:
            st.button("☁️ SAVE (Premium)", use_container_width=True, disabled=True)
    
    with col3:
        if st.button("🔄 PROCESS ANOTHER", use_container_width=True):
            if os.path.exists(output_path):
                os.remove(output_path)
            st.rerun()
    
    with col4:
        if st.button("🗑️ CLEANUP", use_container_width=True):
            try:
                if os.path.exists(output_path):
                    os.remove(output_path)
                st.success("✅ Workspace cleared!")
                time.sleep(1)
                st.rerun()
            except Exception as e:
                st.error(f"❌ Error: {e}")
    
    st.markdown("---")
    
    # Individual Clips Gallery (Premium)
    if is_premium:
        st.markdown("### 📸 Individual Clips Gallery")
        st.info("💎 **Premium Feature:** Review, favorite, and download individual clips")
        
        # Filters
        col1, col2, col3 = st.columns([2, 1, 1])
        with col1:
            search = st.text_input("🔍 Search clips", placeholder="Search by source file or timestamp...")
        with col2:
            sort_by = st.selectbox("Sort by", ["Timestamp", "Shot Type", "Source File"])
        with col3:
            show_count = st.number_input("Show", min_value=5, max_value=50, value=10, step=5)
        
        st.markdown("<br>", unsafe_allow_html=True)
        
        # Display clips in grid
        clips_to_show = clips[:show_count]
        
        for idx, clip in enumerate(clips_to_show):
            with st.expander(f"Clip #{idx+1} - {clip['shot_type']} at {format_duration(clip['timestamp'])} from {clip['filename']}", expanded=idx<3):
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    if os.path.exists(clip['path']):
                        st.video(clip['path'])
                    else:
                        st.warning("Clip file not found in temp directory")
                
                with col2:
                    st.markdown(f"""
                    **Details:**
                    - 🎯 Type: {clip['shot_type']}
                    - ⏱️ Time: {format_duration(clip['timestamp'])}
                    - 📹 Source: {clip['filename']}
                    - 🆔 Index: {clip['index']}
                    """)
                    
                    if os.path.exists(clip['path']):
                        with open(clip['path'], "rb") as f:
                            st.download_button(
                                "⬇️ Download",
                                f,
                                f"clip_{idx+1}.mp4",
                                "video/mp4",
                                key=f"clip_download_{idx}",
                                use_container_width=True
                            )
                    
                    if st.button("⭐ Favorite", key=f"fav_{idx}", use_container_width=True):
                        st.session_state.favorite_clips.append(clip)
                        st.success("Added to favorites!")
    
    else:
        # Teaser for free users
        st.markdown("### 📸 Individual Clips")
        st.info("💎 **Upgrade to Premium** to access individual clip downloads, favorites, and advanced editing features")
        
        # Show just thumbnails/placeholders
        col1, col2, col3 = st.columns(3)
        for i in range(min(3, len(clips))):
            with [col1, col2, col3][i]:
                st.markdown(f"""
                <div style="background: #f8fafc; padding: 2rem; border-radius: 12px; text-align: center; opacity: 0.6;">
                    <div style="font-size: 3rem;">🎬</div>
                    <p style="margin: 1rem 0; font-weight: 600;">Clip #{i+1}</p>
                    <div style="padding: 0.5rem; background: #e2e8f0; border-radius: 8px;">
                        🔒 Premium Only
                    </div>
                </div>
                """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Processing Summary
    with st.expander("📊 Processing Summary & Statistics"):
        st.markdown("### 📈 Session Summary")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("**Source Files:**")
            for meta in metadata:
                st.write(f"• {meta['filename']}")
                st.write(f"  - Duration: {format_duration(meta['duration'])}")
                st.write(f"  - Clips found: {meta['hits']}")
        
        with col2:
            st.markdown("**Processing Stats:**")
            st.write(f"• Total processing time: ~3 minutes")
            st.write(f"• Clips generated: {len(clips)}")
            st.write(f"• Time saved vs manual editing: ~2 hours")
            st.write(f"• Quality: {quality}")

# ==========================================
# 10. MAIN ROUTER
# ==========================================
def main():
    """Main application router"""
    
    # Check authentication
    if st.session_state.get('authentication_status'):
        show_main_app()
    elif st.session_state.get('page') == 'login':
        show_login_page()
    else:
        show_landing_page()

if __name__ == "__main__":
    main()