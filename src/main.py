import cv2
import numpy as np
import librosa
import sounddevice as sd
import threading
import queue
import time
import warnings
import os

# Suppress Mac-specific audio and version warnings
warnings.filterwarnings("ignore")

# --- SETTINGS ---
video_path = "videos/test_video.mp4"
SOUND_SENSITIVITY = 0.15  # Low = Less strict (catches quiet hits)
MIN_VOL_JUMP = 0.05       # Low = Catches hits without a sharp "pop"
EXTRA_ACTION_SECONDS = 2  # Buffer shown after the hit
HITS_FILE = "hits.txt"

def analyze_video():
    """Step 1: Scans the audio file once to find every hit timestamp."""
    print("--- STEP 1: ANALYZING AUDIO ---")
    if not os.path.exists(video_path):
        print(f"Error: Could not find {video_path}")
        return None, None, []

    try:
        # sr=None preserves the native quality of the video audio
        y, sr = librosa.load(video_path, sr=None)
    except Exception as e:
        print(f"Error loading audio: {e}")
        return None, None, []

    hop_length = 512
    energy = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    
    hits = []
    prev_vol = energy[0] if len(energy) > 0 else 0
    
    for i, current_vol in enumerate(energy):
        current_sec = (i * hop_length) / sr
        vol_diff = current_vol - prev_vol
        
        # Catch early hits (0-2s) via raw volume OR standard sharp spikes
        is_early = (current_sec < 2.0 and current_vol > 0.12)
        is_standard = (current_vol > SOUND_SENSITIVITY and vol_diff > MIN_VOL_JUMP)
        
        if is_early or is_standard:
            # Debounce: Ensure we don't log the same ball twice
            if not hits or (current_sec - hits[-1]) > EXTRA_ACTION_SECONDS:
                hits.append(current_sec)
        
        prev_vol = current_vol
    
    print(f"Analysis complete. Found {len(hits)} potential hits.")
    return y, sr, hits

def audio_worker(audio_data, sr, audio_q):
    """Background thread to manage audio playback without lagging the video."""
    try:
        channels = 1 if len(audio_data.shape) == 1 else audio_data.shape[1]
        # blocksize=2048 prevents the Mac AUHAL -50 error
        with sd.OutputStream(samplerate=sr, channels=channels, blocksize=2048) as stream:
            while True:
                chunk = audio_q.get()
                if chunk is None: break
                stream.write(chunk.astype(np.float32))
    except Exception:
        pass

def play_video_with_audio(audio_data, sr, hit_list):
    """Step 2: Smooth playback with audio and terminal logging."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_duration = 1.0 / fps
    
    # Initialize Audio Thread
    audio_q = queue.Queue(maxsize=50)
    t = threading.Thread(target=audio_worker, args=(audio_data, sr, audio_q), daemon=True)
    t.start()
    
    cv2.namedWindow("Cricket_Pro_View", cv2.WINDOW_NORMAL)
    last_printed_hit = -1 

    print("\n--- STEP 2: STARTING PLAYBACK ---")
    print("Watching for hits... Press 'q' to quit and save timestamps.")

    while True:
        loop_start = time.time()
        ret, frame = cap.read()
        
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            last_printed_hit = -1
            continue

        current_frame = cap.get(cv2.CAP_PROP_POS_FRAMES)
        current_sec = current_frame / fps
        
        # Audio Chunking: Send audio piece matching this specific video frame
        sample_start = int(current_sec * sr)
        sample_end = int((current_sec + 1/fps) * sr)
        if sample_end < len(audio_data):
            chunk = audio_data[sample_start:sample_end]
            if not audio_q.full():
                audio_q.put(chunk)

        # Hit detection window check
        active_hit_time = None
        for h in hit_list:
            if h <= current_sec <= (h + EXTRA_ACTION_SECONDS):
                active_hit_time = h
                break

        # UI Visuals & Terminal Logging
        if active_hit_time is not None:
            label = "HIT DETECTED!"
            color = (0, 0, 255) # Red
            
            # Print to terminal only once per hit occurrence
            if active_hit_time != last_printed_hit:
                mins, secs = int(active_hit_time // 60), int(active_hit_time % 60)
                msecs = int((active_hit_time - int(active_hit_time)) * 1000)
                print(f"LOGGED: {mins:02d}:{secs:02d}.{msecs:03d}")
                last_printed_hit = active_hit_time
        else:
            label = "SCANNING..."
            color = (0, 255, 0) # Green
        
        cv2.putText(frame, f"{int(current_sec//60):02d}:{int(current_sec%60):02d} | {label}", 
                    (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        
        cv2.imshow("Cricket_Pro_View", frame)

        # Real-time synchronization
        elapsed = time.time() - loop_start
        wait_time = max(1, int((frame_duration - elapsed) * 1000))
        
        if cv2.waitKey(wait_time) & 0xFF == ord('q'):
            audio_q.put(None)
            break

    cap.release()
    cv2.destroyAllWindows()
    
    # SAVE HITS TO FILE
    if hit_list:
        with open(HITS_FILE, "w") as f:
            for hit in hit_list:
                f.write(f"{hit}\n")
        print(f"\nSUCCESS: Saved {len(hit_list)} hits to {HITS_FILE}")
        print("Now run: python clipper.py")

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    y_audio, sampling_rate, detected_hits = analyze_video()
    if y_audio is not None:
        play_video_with_audio(y_audio, sampling_rate, detected_hits)