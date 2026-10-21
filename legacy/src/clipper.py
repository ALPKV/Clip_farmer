import os
import subprocess

# --- SETTINGS ---
video_path = "videos/test_video.mp4"
output_folder = "highlights"
hits_file = "hits.txt"

def create_highlights():
    # 1. Check for the timestamps file from main.py
    if not os.path.exists(hits_file):
        print(f"Error: {hits_file} not found. Please run main.py first and press 'q' to save hits.")
        return
    
    with open(hits_file, "r") as f:
        hit_timestamps = [float(line.strip()) for line in f if line.strip()]

    if not hit_timestamps:
        print("No hits found in hits.txt.")
        return

    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    clip_files = []
    print(f"Creating {len(hit_timestamps)} clips (2s before, 1.5s after)...")

    for i, ts in enumerate(hit_timestamps):
        # Calculate timing
        start_time = max(0, ts - 2)
        duration = 3.5  # 2.0s lead-up + 1.5s follow-through
        
        output_clip = f"{output_folder}/hit_{i+1}.mp4"
        
        # FFmpeg command for Mac/QuickTime compatibility
        # -pix_fmt yuv420p: Essential for viewing in Apple Photos/QuickTime
        # -async 1: Keeps audio and video perfectly aligned at the cut point
        cmd = [
            'ffmpeg', '-y',
            '-ss', str(start_time),
            '-t', str(duration),
            '-i', video_path,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '20',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-async', '1',
            output_clip
        ]
        
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        clip_files.append(output_clip)
        print(f"  [✓] Generated clip {i+1} at {ts:.2f}s")

    # 2. Merge all clips into the final highlight reel
    with open("list.txt", "w") as f:
        for clip in clip_files:
            f.write(f"file '{os.path.abspath(clip)}'\n")

    print("\nStitching highlights into final_highlights.mp4...")
    
    # We use -c copy here because all individual clips were encoded 
    # identically in the previous step, making the merge instant.
    merge_cmd = [
        'ffmpeg', '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        '-movflags', '+faststart',
        'final_highlights.mp4'
    ]
    
    subprocess.run(merge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    
    # Cleanup temporary list file
    if os.path.exists("list.txt"):
        os.remove("list.txt")
        
    print("\n--- PROCESS COMPLETE ---")
    print(f"Individual clips are in: /{output_folder}")
    print("Full reel saved as: final_highlights.mp4")
    print("Reminder: Use 'Reveal in Finder' to play with sound!")

if __name__ == "__main__":
    create_highlights()