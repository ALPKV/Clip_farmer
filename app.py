import streamlit as st
import librosa
import subprocess
import os
import yaml
from yaml.loader import SafeLoader
import streamlit_authenticator as stauth

# --- 1. AUTHENTICATION SETUP ---
with open('config.yaml') as file:
    config = yaml.load(file, Loader=SafeLoader)

authenticator = stauth.Authenticate(
    config['credentials'],
    config['cookie']['name'],
    config['cookie']['key'],
    config['cookie']['expiry_days'],
    config['preauthorized']
)

# Render the login widget
name, authentication_status, username = authenticator.login('Login', 'main')

if authentication_status == False:
    st.error('Username/password is incorrect')
elif authentication_status == None:
    st.warning('Please enter your username and password')
elif authentication_status:
    # --- 2. THE MAIN APP (Only shows if logged in) ---
    
    st.set_page_config(page_title="Cricket Pro Web", layout="wide")
    
    # Sidebar with Logout and Monetization
    with st.sidebar:
        st.write(f"Welcome, **{name}**!")
        authenticator.logout('Logout', 'sidebar')
        st.divider()
        st.header("💎 PRO FEATURES")
        st.info("Upgrade to remove watermarks and process 4K video.")
        # Replace this URL with your actual Stripe Payment Link later
        st.link_button("🚀 UPGRADE TO PRO", "https://buy.stripe.com/test_link")
        st.divider()
        sensitivity = st.slider("Sound Sensitivity", 0.01, 0.50, 0.15)
        padding = st.slider("Seconds BEFORE hit", 0.5, 4.0, 2.0)
        duration = st.slider("Clip duration", 1.0, 10.0, 4.0)

    st.title("🏏 Cricket Highlight Pro")
    uploaded_file = st.file_uploader("Upload Match Video", type=["mp4", "mov"])

    if uploaded_file:
        video_path = "input_video.mp4"
        with open(video_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        
        # --- SCAN LOGIC ---
        if st.button("🔍 SCAN FOR HITS"):
            with st.spinner("Analyzing Audio..."):
                y, sr = librosa.load(video_path, sr=None)
                energy = librosa.feature.rms(y=y)[0]
                
                found_hits = []
                hop_length = 512 
                for i, vol in enumerate(energy):
                    curr_ts = (i * hop_length) / sr
                    if vol > sensitivity:
                        if not found_hits or (curr_ts - found_hits[-1]) > 3.0:
                            found_hits.append(round(curr_ts, 2))
                
                st.session_state['hits'] = found_hits
                st.session_state['scan_done'] = True

        # --- SELECTION & RENDERING ---
        if st.session_state.get('scan_done'):
            all_hits = st.session_state.get('hits', [])
            selected_hits = []
            cols = st.columns(5)
            for i, ts in enumerate(all_hits):
                with cols[i % 5]:
                    if st.checkbox(f"Hit @ {ts}s", value=True, key=f"h_{i}"):
                        selected_hits.append(ts)

            if st.button("🎬 GENERATE REEL"):
                # Processing Logic
                clip_names = []
                for i, ts in enumerate(selected_hits):
                    out_clip = f"temp_clip_{i}.mp4"
                    start_time = max(0, ts - padding)
                    cmd = [
                        'ffmpeg', '-y', '-ss', str(start_time), '-t', str(duration),
                        '-i', video_path, '-c:v', 'libx264', '-preset', 'ultrafast',
                        '-c:a', 'aac', out_clip
                    ]
                    subprocess.run(cmd, capture_output=True)
                    clip_names.append(out_clip)
                
                # Merge
                with open("list.txt", "w") as f:
                    for c in clip_names:
                        f.write(f"file '{os.path.abspath(c)}'\n")
                
                subprocess.run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'final_reel.mp4'])
                st.video("final_reel.mp4")
                with open("final_reel.mp4", "rb") as f:
                    st.download_button("📥 DOWNLOAD", f, "highlights.mp4")