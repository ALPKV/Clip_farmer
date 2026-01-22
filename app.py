import streamlit as st
import librosa
import subprocess
import os
import tempfile
import streamlit_authenticator as stauth

# --- 0. PAGE CONFIG ---
st.set_page_config(page_title="Clip Farmer Pro", layout="wide")

# --- 1. SECURE AUTHENTICATION ---
if "credentials" in st.secrets:
    config = st.secrets.to_dict()
    authenticator = stauth.Authenticate(
        config['credentials'],
        config['cookie']['name'],
        config['cookie']['key'],
        config['cookie']['expiry_days']
    )
else:
    st.error("Secrets not configured. Please check .streamlit/secrets.toml")
    st.stop()

login_result = authenticator.login(location='main')

PREMIUM_USERS = ["Admin User", "Pro Editor"] 

if st.session_state.get('authentication_status'):
    is_premium = st.session_state.get('name') in PREMIUM_USERS
    
    # --- SIDEBAR & UI ---
    with st.sidebar:
        st.write(f"Logged in as: **{st.session_state['name']}**")
        authenticator.logout('Logout', 'sidebar')
        st.divider()
        st.header("Settings")
        sensitivity = st.slider("Sound Sensitivity", 0.01, 0.50, 0.15)
        padding = st.slider("Lead-in (sec)", 0.5, 4.0, 1.0)
        duration = st.slider("Total Length (sec)", 1.0, 10.0, 2.5)

    st.title("🚜 Clip Farmer Cloud")

    uploaded_files = st.file_uploader("Upload Match Videos", type=["mp4", "mov"], accept_multiple_files=True)

    if uploaded_files:
        # Create a unique, isolated temporary directory for THIS specific session
        with tempfile.TemporaryDirectory() as tmp_dir:
            
            all_files_valid = True
            if not is_premium:
                for f in uploaded_files:
                    if f.size > (50 * 1024 * 1024):
                        st.error(f"❌ '{f.name}' exceeds 50MB Free Limit.")
                        all_files_valid = False

            if all_files_valid:
                if st.button("🔍 SCAN & GENERATE"):
                    all_detected_hits = []
                    
                    with st.status("Processing Securely...", expanded=True) as status:
                        # 1. Process Inputs & Scan
                        progress_bar = st.progress(0, text="Analyzing audio...")
                        for i, uploaded_file in enumerate(uploaded_files):
                            input_path = os.path.join(tmp_dir, f"input_{i}.mp4")
                            with open(input_path, "wb") as f:
                                f.write(uploaded_file.getbuffer())
                            
                            st.write(f"Scanning File {i+1}: {uploaded_file.name}...")
                            try:
                                y, sr = librosa.load(input_path, sr=None)
                                energy = librosa.feature.rms(y=y)[0]
                                hop_length = 512 
                                for idx, vol in enumerate(energy):
                                    curr_ts = (idx * hop_length) / sr
                                    if vol > sensitivity:
                                        # Group hits that are too close together
                                        if not all_detected_hits or (curr_ts - all_detected_hits[-1][1]) > 3.0:
                                            all_detected_hits.append((input_path, round(curr_ts, 2)))
                                
                                progress_bar.progress((i + 1) / len(uploaded_files), text=f"Finished scanning {i+1}/{len(uploaded_files)}")
                            except Exception as e:
                                st.error(f"Error scanning {uploaded_file.name}: {e}")

                        # 2. Generate Clips
                        final_clips = []
                        if all_detected_hits:
                            st.write(f"Detected {len(all_detected_hits)} hits. Extracting clips...")
                            for idx, (v_path, ts) in enumerate(all_detected_hits):
                                clip_path = os.path.join(tmp_dir, f"clip_{idx}.mp4")
                                s_time = max(0, ts - padding)
                                
                                subprocess.run([
                                    'ffmpeg', '-y', '-ss', str(s_time), '-t', str(duration), 
                                    '-i', v_path, '-vf', 'fps=30', '-r', '30', 
                                    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', 
                                    '-movflags', '+faststart', '-c:a', 'aac', clip_path
                                ], capture_output=True)
                                final_clips.append(clip_path)

                        # 3. Concatenate
                        if final_clips:
                            list_path = os.path.join(tmp_dir, "list.txt")
                            with open(list_path, "w") as f:
                                for c in final_clips:
                                    f.write(f"file '{os.path.abspath(c)}'\n")
                            
                            output_path = "master_highlights.mp4" 
                            subprocess.run([
                                'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list_path, 
                                '-c:v', 'copy', '-c:a', 'copy', output_path
                            ])
                            
                            status.update(label="Reel Generated!", state="complete")
                            st.toast("Processing complete!", icon="✅")
                            
                            st.video(output_path)
                            
                            col1, col2 = st.columns(2)
                            with col1:
                                with open(output_path, "rb") as f:
                                    st.download_button("📥 DOWNLOAD REEL", f, "highlights.mp4", type="primary")
                            
                            with col2:
                                if st.button("🗑️ CLEANUP WORKSPACE"):
                                    try:
                                        if os.path.exists(output_path):
                                            os.remove(output_path)
                                        # Cleanup any stray files that might have been created
                                        stray_files = ["input_highlights.mp4", "list.txt"]
                                        for stray in stray_files:
                                            if os.path.exists(stray):
                                                os.remove(stray)
                                        st.success("Workspace cleared!")
                                        st.rerun()
                                    except Exception as e:
                                        st.error(f"Cleanup failed: {e}")
                        else:
                            status.update(label="No hits found.", state="error")
                            st.warning("No loud sound triggers detected. Try lowering the sensitivity.")

elif st.session_state.get('authentication_status') == False:
    st.error('Incorrect Password')
elif st.session_state.get('authentication_status') is None:
    st.info('Please enter your username and password')