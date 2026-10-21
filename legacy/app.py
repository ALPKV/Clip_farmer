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
# 0. PAGE CONFIG & SLEEK MODERN CSS
# ==========================================
st.set_page_config(
    page_title="Clip Farmer Pro | AI Cricket Highlights",
    page_icon="🏏",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Ultra-clean, high-tech CSS
st.markdown("""
<style>
    /* Import Modern Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    * {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    /* Hide Streamlit Branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
    /* Clean Background */
    .main {
        background: #ffffff;
        padding: 0;
    }
    
    /* Minimal Hero Section */
    .hero-minimal {
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        padding: 6rem 2rem 4rem 2rem;
        text-align: center;
        position: relative;
        overflow: hidden;
    }
    
    .hero-minimal::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: 
            radial-gradient(circle at 20% 50%, rgba(0, 0, 0, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(0, 0, 0, 0.01) 0%, transparent 50%);
        pointer-events: none;
    }
    
    .hero-minimal h1 {
        color: #0f172a;
        font-size: 4.5rem;
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.03em;
        position: relative;
        z-index: 1;
    }
    
    .hero-minimal .tagline {
        color: #64748b;
        font-size: 1.3rem;
        margin-top: 1.5rem;
        font-weight: 400;
        letter-spacing: 0.01em;
        position: relative;
        z-index: 1;
    }
    
    .hero-minimal .cta-group {
        margin-top: 3rem;
        display: flex;
        gap: 1rem;
        justify-content: center;
        position: relative;
        z-index: 1;
    }
    
    /* Glassmorphism Cards */
    .glass-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 2rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .glass-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 215, 0, 0.3);
        transform: translateY(-4px);
    }
    
    /* Clean Feature Cards */
    .feature-minimal {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 2.5rem 2rem;
        transition: all 0.3s ease;
        text-align: center;
    }
    
    .feature-minimal:hover {
        border-color: #000000;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
    }
    
    .feature-minimal .icon {
        font-size: 2.5rem;
        margin-bottom: 1.5rem;
        display: block;
    }
    
    .feature-minimal h3 {
        font-size: 1.25rem;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 0.75rem;
    }
    
    .feature-minimal p {
        color: #64748b;
        font-size: 0.95rem;
        line-height: 1.6;
        margin: 0;
    }
    
    /* Modern Stats */
    .stat-minimal {
        text-align: center;
        padding: 2rem 1rem;
    }
    
    .stat-minimal .number {
        font-size: 2.5rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0.5rem;
    }
    
    .stat-minimal .label {
        font-size: 0.9rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
    }
    
    /* Clean Pricing Cards */
    .pricing-minimal {
        background: #ffffff;
        border: 2px solid #e2e8f0;
        border-radius: 16px;
        padding: 2.5rem;
        transition: all 0.3s ease;
        height: 100%;
    }
    
    .pricing-minimal:hover {
        border-color: #cbd5e1;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
    }
    
    .pricing-minimal.featured {
        background: #ffffff;
        border-color: #000000;
        border-width: 3px;
        position: relative;
        transform: scale(1.05);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    }
    
    .pricing-minimal.featured * {
        color: #0f172a !important;
    }
    
    .pricing-minimal.featured .price {
        color: #0f172a !important;
    }
    
    .featured-badge {
        background: #000000;
        color: #ffffff;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: inline-block;
        margin-bottom: 1rem;
    }
    
    .pricing-minimal .tier {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0.5rem;
    }
    
    .pricing-minimal .price {
        font-size: 3rem;
        font-weight: 800;
        color: #0f172a;
        margin: 1rem 0;
    }
    
    .pricing-minimal .description {
        color: #64748b;
        font-size: 0.95rem;
        margin-bottom: 2rem;
    }
    
    .pricing-minimal ul {
        text-align: left;
        padding-left: 0;
        list-style: none;
    }
    
    .pricing-minimal li {
        color: #475569;
        font-size: 0.95rem;
        padding: 0.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .pricing-minimal.featured li {
        color: #cbd5e1 !important;
    }
    
    /* Modern Buttons */
    .btn-primary {
        background: #000000;
        color: white;
        padding: 1rem 2.5rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 1rem;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: inline-block;
        text-decoration: none;
    }
    
    .btn-primary:hover {
        background: #1a1a1a;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
    
    .btn-secondary {
        background: transparent;
        color: #000000;
        padding: 1rem 2.5rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 1rem;
        border: 2px solid #000000;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: inline-block;
        text-decoration: none;
    }
    
    .btn-secondary:hover {
        background: #000000;
        color: white;
        transform: translateY(-2px);
    }
    
    .stButton>button {
        background: #000000;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.875rem 2rem;
        font-weight: 600;
        font-size: 1rem;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    
    .stButton>button:hover {
        background: #1a1a1a;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
    
    /* Clean Sections */
    .section {
        padding: 5rem 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .section-title {
        font-size: 2.5rem;
        font-weight: 700;
        color: #0f172a;
        text-align: center;
        margin-bottom: 3rem;
        letter-spacing: -0.02em;
    }
    
    .section-subtitle {
        font-size: 1.1rem;
        color: #64748b;
        text-align: center;
        margin-top: -2rem;
        margin-bottom: 3rem;
    }
    
    /* Testimonial Clean */
    .testimonial-clean {
        background: #f8fafc;
        border-left: 3px solid #000000;
        padding: 2rem;
        border-radius: 8px;
        margin: 1rem 0;
    }
    
    .testimonial-clean .quote {
        font-size: 1.05rem;
        line-height: 1.7;
        color: #334155;
        margin-bottom: 1.5rem;
        font-style: italic;
    }
    
    .testimonial-clean .author {
        font-weight: 600;
        color: #0f172a;
    }
    
    .testimonial-clean .role {
        font-size: 0.9rem;
        color: #64748b;
        margin-top: 0.25rem;
    }
    
    /* Progress Bar */
    .stProgress > div > div {
        background: linear-gradient(90deg, #000000 0%, #4a4a4a 100%);
    }
    
    /* Sidebar */
    [data-testid="stSidebar"] {
        background: #f8fafc;
        border-right: 1px solid #e2e8f0;
    }
    
    [data-testid="stSidebar"] * {
        color: #0f172a !important;
    }
    
    /* Clean Upload Zone */
    .upload-clean {
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        padding: 3rem 2rem;
        text-align: center;
        background: #f8fafc;
        transition: all 0.3s ease;
    }
    
    .upload-clean:hover {
        border-color: #000000;
        background: #f0f0f0;
    }
    
    /* Minimal Spacing */
    .spacer-sm {
        height: 2rem;
    }
    
    .spacer-md {
        height: 4rem;
    }
    
    .spacer-lg {
        height: 6rem;
    }
    
    /* Divider */
    hr {
        border: none;
        border-top: 1px solid #e2e8f0;
        margin: 3rem 0;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
        .hero-minimal h1 {
            font-size: 2.5rem;
        }
        
        .hero-minimal .tagline {
            font-size: 1rem;
        }
        
        .section {
            padding: 3rem 1rem;
        }
        
        .section-title {
            font-size: 2rem;
        }
    }
    
    /* Clean Expander */
    .streamlit-expanderHeader {
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
    }
    
    /* Badge */
    .badge-clean {
        display: inline-block;
        padding: 0.4rem 0.9rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.03em;
    }
    
    .badge-success {
        background: #dcfce7;
        color: #166534;
    }
    
    .badge-premium {
        background: #fef3c7;
        color: #854d0e;
    }
    
    .badge-free {
        background: #e0f2fe;
        color: #075985;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# 1. CONFIGURATION & CONSTANTS
# ==========================================

PREMIUM_USERS = ["Admin User", "Pro Editor"]

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
        'file_size_limit_mb': None,
        'max_clips_per_session': None,
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

SENSITIVITY_PRESETS = {
    "💪 Aggressive Shots": {'sensitivity': 0.20, 'description': "Detects hard-hit shots, boundaries"},
    "🛡️ Defensive Play": {'sensitivity': 0.10, 'description': "Picks up soft touches, edges"},
    "⚖️ Balanced": {'sensitivity': 0.15, 'description': "Good mix of all shot types"},
    "🎯 Custom": {'sensitivity': 0.15, 'description': "Set your own threshold"}
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
    st.error("🔒 Authentication not configured.")
    st.stop()

# ==========================================
# 3. SESSION STATE
# ==========================================
def init_session_state():
    defaults = {
        'page': 'landing',
        'processing_history': [],
        'total_clips_generated': 0,
        'favorite_clips': [],
        'processing_stats': {'total_time_saved': 0}
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

init_session_state()

# ==========================================
# 4. UTILITY FUNCTIONS
# ==========================================
def format_file_size(size_bytes):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"

def format_duration(seconds):
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def estimate_processing_time(file_size_mb, is_premium=False):
    base_time = file_size_mb * 0.3
    if is_premium:
        base_time /= 3
    return max(1, int(base_time))

# ==========================================
# 5. CLEAN LANDING PAGE
# ==========================================
def show_landing_page():
    """Ultra-clean, high-tech landing page"""
    
    # Top navigation bar with login button
    st.markdown("""
    <div style="position: fixed; top: 0; left: 0; right: 0; background: white; 
                padding: 0.75rem 2rem; border-bottom: 1px solid #e2e8f0; z-index: 1000;
                display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 1rem; font-weight: 700; color: #0f172a;">🏏 Clip Farmer Pro</div>
    </div>
    """, unsafe_allow_html=True)
    
    # Login button in top left (actually top right for better UX)
    col1, col2, col3 = st.columns([6, 1, 1])
    with col2:
        if st.button("Login", key="nav_login", use_container_width=True):
            st.session_state.page = 'login'
            st.rerun()
    with col3:
        if st.button("Sign Up", key="nav_signup", use_container_width=True, type="primary"):
            st.session_state.page = 'login'
            st.rerun()
    
    st.markdown('<div style="height: 45px;"></div>', unsafe_allow_html=True)  # Spacer for fixed nav
    
    # Hero Section
    st.markdown("""
    <div class="hero-minimal">
        <h1>Clip Farmer Pro</h1>
        <p class="tagline">AI-powered cricket highlight generation in seconds</p>
        <div class="cta-group">
            <button class="btn-primary" onclick="window.location.href='#'">Start Free</button>
            <button class="btn-secondary" onclick="window.location.href='#'">Watch Demo</button>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2 = st.columns([1, 1], gap="large")
    with col1:
        if st.button("🎯 START FREE", use_container_width=True, type="primary", key="hero_start_free"):
            st.session_state.page = 'login'
            st.rerun()
    with col2:
        if st.button("📺 WATCH DEMO", use_container_width=True, key="hero_watch_demo"):
            st.info("Demo video coming soon!")
    
    st.markdown('<div class="spacer-lg"></div>', unsafe_allow_html=True)
    
    # Stats
    col1, col2, col3, col4 = st.columns(4)
    stats_data = [
        ("15K+", "Clips Generated"),
        ("850+", "Active Users"),
        ("62K+", "Hours Saved"),
        ("4.9★", "User Rating")
    ]
    
    for col, (number, label) in zip([col1, col2, col3, col4], stats_data):
        with col:
            st.markdown(f"""
            <div class="stat-minimal">
                <div class="number">{number}</div>
                <div class="label">{label}</div>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown('<div class="spacer-lg"></div>', unsafe_allow_html=True)
    st.markdown('<hr>', unsafe_allow_html=True)
    
    # Features
    st.markdown('<h2 class="section-title">Why Choose Clip Farmer Pro</h2>', unsafe_allow_html=True)
    st.markdown('<div class="spacer-md"></div>', unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3, gap="large")
    
    features = [
        ("⚡", "Lightning Fast", "Process hours of footage in minutes with AI-powered detection"),
        ("🎯", "Precision Clips", "95%+ accuracy in detecting bat-on-ball contact"),
        ("📱", "Export Ready", "One-click export for Instagram, TikTok, YouTube")
    ]
    
    for col, (icon, title, desc) in zip([col1, col2, col3], features):
        with col:
            st.markdown(f"""
            <div class="feature-minimal">
                <span class="icon">{icon}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown('<div class="spacer-lg"></div>', unsafe_allow_html=True)
    st.markdown('<hr>', unsafe_allow_html=True)
    
    # Pricing
    st.markdown('<h2 class="section-title">Simple, Transparent Pricing</h2>', unsafe_allow_html=True)
    st.markdown('<p class="section-subtitle">Choose the plan that works for you</p>', unsafe_allow_html=True)
    st.markdown('<div class="spacer-md"></div>', unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3, gap="large")
    
    # Free
    with col1:
        st.markdown("""
        <div class="pricing-minimal">
            <div class="tier">Free</div>
            <div class="price">$0</div>
            <div class="description">Perfect for testing</div>
            <ul>
                <li>✓ 50MB file limit</li>
                <li>✓ 720p exports</li>
                <li>✓ 20 clips/session</li>
                <li>✓ Basic detection</li>
                <li>✗ Watermarked</li>
                <li>✗ No storage</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
    
    # Premium (Featured)
    with col2:
        st.markdown("""
        <div class="pricing-minimal featured">
            <div class="featured-badge">MOST POPULAR</div>
            <div class="tier">Premium</div>
            <div class="price">$19.99</div>
            <div class="description">For serious creators</div>
            <ul>
                <li>✓ Unlimited uploads</li>
                <li>✓ 4K UHD exports</li>
                <li>✓ Unlimited clips</li>
                <li>✓ Advanced AI</li>
                <li>✓ No watermarks</li>
                <li>✓ 30-day storage</li>
                <li>✓ Priority processing</li>
                <li>✓ API access</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
    
    # Enterprise
    with col3:
        st.markdown("""
        <div class="pricing-minimal">
            <div class="tier">Enterprise</div>
            <div class="price">Custom</div>
            <div class="description">For teams</div>
            <ul>
                <li>✓ All Premium features</li>
                <li>✓ Multi-user accounts</li>
                <li>✓ Team dashboard</li>
                <li>✓ White-label</li>
                <li>✓ Custom integrations</li>
                <li>✓ Dedicated support</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown('<div class="spacer-lg"></div>', unsafe_allow_html=True)
    st.markdown('<hr>', unsafe_allow_html=True)
    
    # FAQ
    st.markdown('<h2 class="section-title">Frequently Asked Questions</h2>', unsafe_allow_html=True)
    st.markdown('<div class="spacer-md"></div>', unsafe_allow_html=True)
    
    with st.expander("What video formats are supported?"):
        st.write("MP4, MOV, AVI, and MKV. We recommend 1080p at 30fps or higher.")
    
    with st.expander("How fast is the processing?"):
        st.write("Free: ~2-3 min per 10-min video. Premium: 3x faster with priority queue.")
    
    with st.expander("How accurate is the AI?"):
        st.write("95%+ accuracy in detecting bat-on-ball contact. Premium gets advanced ML models.")
    
    with st.expander("Can I cancel anytime?"):
        st.write("Yes! Month-to-month with no commitment. Cancel anytime.")
    
    st.markdown('<div class="spacer-lg"></div>', unsafe_allow_html=True)
    
    # Final CTA
    st.markdown("""
    <div style="background: #f8fafc; padding: 4rem 2rem; text-align: center; border-radius: 16px;">
        <h2 style="color: #0f172a; font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem;">
            Ready to Get Started?
        </h2>
        <p style="color: #64748b; font-size: 1.1rem; margin-bottom: 2rem;">
            Join 850+ cricket creators using Clip Farmer Pro
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        col_a, col_b = st.columns(2)
        with col_a:
            if st.button("🎯 START FREE", use_container_width=True, type="primary", key="cta_start_free"):
                st.session_state.page = 'login'
                st.rerun()
        with col_b:
            if st.button("👑 GO PREMIUM", use_container_width=True, key="cta_go_premium"):
                st.session_state.page = 'login'
                st.rerun()

# ==========================================
# 6. LOGIN PAGE
# ==========================================
def show_login_page():
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("""
        <div style="background: #f8fafc; padding: 3rem 2rem; border-radius: 16px; margin-top: 4rem;">
            <h1 style="color: #0f172a; text-align: center; font-size: 2rem; margin-bottom: 0.5rem;">Welcome Back</h1>
            <p style="color: #64748b; text-align: center; margin-bottom: 2rem;">Sign in to your account</p>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown('<div class="spacer-sm"></div>', unsafe_allow_html=True)
        
        login_result = authenticator.login(location='main')
        
        if st.session_state.get('authentication_status'):
            st.success("✅ Login successful!")
            time.sleep(1)
            st.session_state.page = 'app'
            st.rerun()
        elif st.session_state.get('authentication_status') == False:
            st.error('❌ Incorrect username or password')
        
        st.markdown('<div class="spacer-sm"></div>', unsafe_allow_html=True)
        
        if st.button("← Back to Home", use_container_width=True):
            st.session_state.page = 'landing'
            st.rerun()

# ==========================================
# 7. MAIN APP (Continuing with same logic)
# ==========================================
def show_main_app():
    is_premium = st.session_state.get('name') in PREMIUM_USERS
    user_tier = 'premium' if is_premium else 'free'
    tier_config = PRICING[user_tier]
    
    with st.sidebar:
        st.markdown(f"""
        <div style="background: #ffffff; padding: 1.5rem; border-radius: 12px; text-align: center; 
                    margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">👤</div>
            <h3 style="color: #0f172a; margin: 0.5rem 0; font-size: 1.1rem;">{st.session_state['name']}</h3>
            <span class="badge-clean {'badge-premium' if is_premium else 'badge-free'}">
                {'👑 Premium' if is_premium else '🆓 Free Tier'}
            </span>
        </div>
        """, unsafe_allow_html=True)
        
        authenticator.logout('🚪 Logout', 'sidebar')
        
        st.divider()
        
        st.markdown("### 📊 Statistics")
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Clips", st.session_state.total_clips_generated)
        with col2:
            st.metric("Sessions", len(st.session_state.processing_history))
        
        st.divider()
        
        st.markdown("### ⚙️ Settings")
        
        preset_name = st.selectbox("Detection Preset", list(SENSITIVITY_PRESETS.keys()))
        preset = SENSITIVITY_PRESETS[preset_name]
        
        if preset_name == "🎯 Custom":
            sensitivity = st.slider("Sensitivity", 0.05, 0.40, 0.15, 0.01)
        else:
            sensitivity = preset['sensitivity']
        
        padding = st.slider("Lead-in (sec)", 0.5, 4.0, 1.0, 0.1)
        duration = st.slider("Clip Length (sec)", 1.0, 15.0, 2.5, 0.5)
        
        if not is_premium:
            st.markdown('<div class="spacer-sm"></div>', unsafe_allow_html=True)
            st.info("💎 Upgrade to Premium for advanced features")
    
    st.markdown("""
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
                padding: 3rem 2rem; border-radius: 16px; text-align: center; margin-bottom: 2rem;">
        <h1 style="color: #0f172a; margin: 0; font-size: 2.5rem;">🚜 Clip Farmer Pro</h1>
        <p style="color: #64748b; margin-top: 0.75rem; font-size: 1.1rem;">Transform your footage into highlights</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("### 📤 Upload Videos")
    
    if not is_premium:
        st.warning(f"⚠️ Free tier: 50MB max | 20 clips limit")
    else:
        st.success(f"✅ Premium: Unlimited")
    
    st.markdown("""
    <div class="upload-clean">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📁</div>
        <h3 style="color: #0f172a; margin: 0.5rem 0;">Drop your cricket videos here</h3>
        <p style="color: #64748b; font-size: 0.9rem;">Supports MP4, MOV, AVI, MKV</p>
    </div>
    """, unsafe_allow_html=True)
    
    uploaded_files = st.file_uploader(
        "Select files",
        type=["mp4", "mov", "avi", "mkv"],
        accept_multiple_files=True,
        label_visibility="collapsed"
    )
    
    if uploaded_files:
        st.markdown("### 📋 Files")
        
        all_valid = True
        for idx, file in enumerate(uploaded_files):
            size_mb = file.size / (1024 * 1024)
            
            col1, col2, col3 = st.columns([3, 2, 1])
            with col1:
                st.write(f"**{file.name}**")
            with col2:
                st.write(f"{format_file_size(file.size)}")
            with col3:
                if tier_config['file_size_limit_mb'] and size_mb > tier_config['file_size_limit_mb']:
                    st.markdown('<span class="badge-clean" style="background: #fee2e2; color: #991b1b;">Too Large</span>', unsafe_allow_html=True)
                    all_valid = False
                else:
                    st.markdown('<span class="badge-clean badge-success">Ready</span>', unsafe_allow_html=True)
        
        if all_valid:
            st.markdown('<div class="spacer-sm"></div>', unsafe_allow_html=True)
            if st.button("🔥 START PROCESSING", use_container_width=True, type="primary"):
                process_videos(uploaded_files, sensitivity, padding, duration, is_premium, tier_config)
        else:
            st.error("Some files exceed limits")

# Processing functions remain the same...
def process_videos(uploaded_files, sensitivity, padding, duration, is_premium, tier_config):
    all_detected_hits = []
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        with st.status("Processing...", expanded=True) as status:
            progress = st.progress(0)
            
            input_paths = []
            for i, f in enumerate(uploaded_files):
                path = os.path.join(tmp_dir, f"input_{i}.mp4")
                with open(path, "wb") as fp:
                    fp.write(f.getbuffer())
                input_paths.append((path, f.name))
                progress.progress((i + 1) / len(uploaded_files))
            
            for i, (path, name) in enumerate(input_paths):
                try:
                    y, sr = librosa.load(path, sr=None)
                    energy = librosa.feature.rms(y=y)[0]
                    hop_length = 512
                    
                    for idx, vol in enumerate(energy):
                        ts = (idx * hop_length) / sr
                        if vol > sensitivity:
                            if not all_detected_hits or (ts - all_detected_hits[-1]['timestamp']) > 3.0:
                                all_detected_hits.append({'path': path, 'timestamp': round(ts, 2), 'filename': name})
                except Exception as e:
                    st.error(f"Error: {e}")
            
            if all_detected_hits:
                clips = []
                for idx, hit in enumerate(all_detected_hits[:tier_config['max_clips_per_session'] if tier_config['max_clips_per_session'] else 999]):
                    clip_path = os.path.join(tmp_dir, f"clip_{idx}.mp4")
                    s_time = max(0, hit['timestamp'] - padding)
                    
                    subprocess.run([
                        'ffmpeg', '-y', '-ss', str(s_time), '-t', str(duration),
                        '-i', hit['path'], '-c:v', 'libx264', '-preset', 'ultrafast',
                        '-pix_fmt', 'yuv420p', '-c:a', 'aac', clip_path
                    ], capture_output=True)
                    
                    clips.append({'path': clip_path, 'timestamp': hit['timestamp'], 'filename': hit['filename']})
                
                list_path = os.path.join(tmp_dir, "list.txt")
                with open(list_path, "w") as f:
                    for clip in clips:
                        f.write(f"file '{os.path.abspath(clip['path'])}'\n")
                
                output = "highlights.mp4"
                subprocess.run([
                    'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list_path,
                    '-c', 'copy', output
                ])
                
                status.update(label="✅ Complete!", state="complete")
                st.balloons()
                
                st.session_state.total_clips_generated += len(clips)
                
                display_results(output, clips, is_premium)
            else:
                status.update(label="No hits found", state="error")
                st.warning("Try lowering sensitivity")

def display_results(output_path, clips, is_premium):
    st.markdown("---")
    st.markdown("## 🎉 Your Highlights Are Ready!")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Clips", len(clips))
    with col2:
        st.metric("Duration", f"{len(clips) * 2.5:.1f}s")
    with col3:
        size = os.path.getsize(output_path) / (1024 * 1024)
        st.metric("Size", f"{size:.1f}MB")
    
    st.video(output_path)
    
    col1, col2 = st.columns(2)
    with col1:
        with open(output_path, "rb") as f:
            st.download_button("📥 DOWNLOAD", f, "highlights.mp4", "video/mp4", use_container_width=True, type="primary")
    with col2:
        if st.button("🔄 NEW SESSION", use_container_width=True):
            if os.path.exists(output_path):
                os.remove(output_path)
            st.rerun()

def main():
    if st.session_state.get('authentication_status'):
        show_main_app()
    elif st.session_state.get('page') == 'login':
        show_login_page()
    else:
        show_landing_page()

if __name__ == "__main__":
    main()