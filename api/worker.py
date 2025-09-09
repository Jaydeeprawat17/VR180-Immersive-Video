# worker.py - Simplified version using basic stereo conversion
import sys, os, cv2, subprocess, numpy as np
import json
import glob

def update_progress(step, message, progress=0):
    """Update progress for frontend"""
    progress_data = {
        "step": step,
        "message": message,
        "progress": progress
    }
    print(f"PROGRESS:{json.dumps(progress_data)}")
    sys.stdout.flush()

def create_basic_stereo(img, shift_pixels=10):
    """Create basic stereo effect by shifting pixels based on brightness"""
    h, w, c = img.shape
    
    # Convert to grayscale for depth approximation
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Use Gaussian blur to create depth-like effect
    depth_approx = cv2.GaussianBlur(gray, (21, 21), 0)
    
    # Normalize depth
    depth_norm = depth_approx.astype(np.float32) / 255.0
    
    # Create disparity map
    disparity = shift_pixels * (1 - depth_norm)
    
    # Create coordinate maps
    x_coords, y_coords = np.meshgrid(np.arange(w), np.arange(h))
    
    # Left eye (shift right)
    x_left = np.clip(x_coords + disparity/2, 0, w-1).astype(np.float32)
    y_left = y_coords.astype(np.float32)
    
    # Right eye (shift left)  
    x_right = np.clip(x_coords - disparity/2, 0, w-1).astype(np.float32)
    y_right = y_coords.astype(np.float32)
    
    # Remap images
    left_eye = cv2.remap(img, x_left, y_left, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    right_eye = cv2.remap(img, x_right, y_right, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    
    # Combine side-by-side
    stereo = np.concatenate([left_eye, right_eye], axis=1)
    return stereo

def main():
    try:
        input_video = sys.argv[1]
        output_video = sys.argv[2]
        
        # FFmpeg path
        ffmpeg_path = r"C:\Users\hp\Desktop\ffmpeg-8.0-essentials_build\ffmpeg-8.0-essentials_build\bin\ffmpeg.exe"
        
        update_progress("setup", "Starting conversion...", 5)
        
        # --- Step 1: Extract frames ---
        update_progress("extract", "Extracting frames...", 10)
        os.makedirs("frames", exist_ok=True)
        
        # Extract frames at lower resolution and frame rate for faster processing
        subprocess.run([
            ffmpeg_path, "-i", input_video, 
            "-vf", "select='not(mod(n,3))',scale=480:270",  # Every 3rd frame, smaller size
            "-vsync", "vfr", "-y",
            "frames/frame_%06d.png"
        ], check=True)
        
        # Count extracted frames
        frame_files = sorted(glob.glob("frames/frame_*.png"))
        total_frames = len(frame_files)
        
        if total_frames == 0:
            raise Exception("No frames extracted from video")
            
        update_progress("extract", f"Extracted {total_frames} frames", 20)
        
        # --- Step 2: Process frames ---
        update_progress("process", "Converting to stereo...", 30)
        os.makedirs("stereo_frames", exist_ok=True)
        
        for i, frame_path in enumerate(frame_files):
            try:
                # Read frame
                frame = cv2.imread(frame_path)
                if frame is None:
                    print(f"DEBUG: Could not read frame: {frame_path}")
                    continue
                
                # Create stereo version
                stereo_frame = create_basic_stereo(frame, shift_pixels=8)
                
                # Save stereo frame
                frame_name = os.path.basename(frame_path)
                stereo_path = f"stereo_frames/{frame_name}"
                cv2.imwrite(stereo_path, stereo_frame)
                
                # Update progress every 10 frames
                if i % 10 == 0:
                    progress = 30 + int((i / total_frames) * 50)
                    update_progress("process", f"Processed {i+1}/{total_frames} frames", progress)
                    print(f"DEBUG: Processed {i+1}/{total_frames} frames")
                    
            except Exception as e:
                print(f"DEBUG: Error processing frame {frame_path}: {str(e)}")
                continue
        
        update_progress("process", f"All {total_frames} frames processed", 80)
        
        # --- Step 3: Create final video ---
        update_progress("video", "Creating VR video...", 85)
        
        # Get original video info for frame rate
        info_result = subprocess.run([
            ffmpeg_path, "-i", input_video, "-hide_banner", "-f", "null", "-"
        ], capture_output=True, text=True)
        
        # Default fps
        fps = "30"
        
        # Try to extract fps from ffmpeg output
        output_text = info_result.stderr
        if "fps" in output_text:
            import re
            fps_match = re.search(r'(\d+\.?\d*)\s*fps', output_text)
            if fps_match:
                fps = fps_match.group(1)
        
        update_progress("video", f"Assembling video at {fps} FPS...", 90)
        
        # Create video with original audio
        subprocess.run([
            ffmpeg_path, "-y",
            "-framerate", fps,
            "-i", "stereo_frames/frame_%06d.png",
            "-i", input_video,
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-crf", "20", "-preset", "medium",
            "-c:a", "aac", "-b:a", "128k",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            output_video
        ], check=True)
        
        update_progress("complete", "VR video created successfully!", 100)
        
        # Cleanup
        try:
            import shutil
            if os.path.exists("frames"):
                shutil.rmtree("frames")
            if os.path.exists("stereo_frames"):
                shutil.rmtree("stereo_frames")
        except:
            pass
            
        print("SUCCESS: Basic stereo VR video conversion completed!")
        
    except subprocess.CalledProcessError as e:
        update_progress("error", f"Video processing failed: {str(e)}", 0)
        print(f"FFmpeg error: {e}")
        sys.exit(1)
    except Exception as e:
        update_progress("error", f"Conversion failed: {str(e)}", 0)
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python worker.py <input_video> <output_video>")
        sys.exit(1)
    main()