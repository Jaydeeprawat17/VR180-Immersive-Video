
import os
import shutil
import glob
import time

def cleanup_all_temp_files():
    """Clean up all temporary files and directories"""
    current_dir = "."
    cleaned_count = 0
    
   
    temp_patterns = [
        "temp_frames_*",
        "temp_stereo_*", 
        "out_frames*",
        "frames",
        "stereo_frames"
    ]
    
    print("🧹 Starting comprehensive cleanup...")
    
  
    for pattern in temp_patterns:
        matching_dirs = glob.glob(pattern)
        for temp_dir in matching_dirs:
            try:
                if os.path.exists(temp_dir) and os.path.isdir(temp_dir):
                    print(f"Removing directory: {temp_dir}")
                    shutil.rmtree(temp_dir)
                    cleaned_count += 1
            except Exception as e:
                print(f"Error removing {temp_dir}: {e}")
    
  
    image_patterns = ["*.png", "*.jpg", "*.jpeg", "frame_*.png"]
    for pattern in image_patterns:
        matching_files = glob.glob(pattern)
        for img_file in matching_files:
            try:
                if os.path.isfile(img_file) and ("frame_" in img_file or img_file.startswith("temp_")):
                    print(f"Removing file: {img_file}")
                    os.remove(img_file)
                    cleaned_count += 1
            except Exception as e:
                print(f"Error removing {img_file}: {e}")
    
    
    uploads_dir = "uploads"
    if os.path.exists(uploads_dir):
        upload_files = os.listdir(uploads_dir)
        for upload_file in upload_files:
            file_path = os.path.join(uploads_dir, upload_file)
            try:
                if os.path.isfile(file_path):
                    # Remove files older than 1 hour
                    file_age = time.time() - os.path.getmtime(file_path)
                    if file_age > 3600:  # 1 hour in seconds
                        print(f"Removing old upload: {upload_file}")
                        os.remove(file_path)
                        cleaned_count += 1
            except Exception as e:
                print(f"Error removing upload {upload_file}: {e}")
    
    print(f"✅ Cleanup completed! Removed {cleaned_count} items.")
    
   
    remaining_dirs = []
    for item in os.listdir("."):
        if (item.startswith("temp_") or 
            item.startswith("out_") or 
            item in ["frames", "stereo_frames"]) and os.path.isdir(item):
            remaining_dirs.append(item)
    
    if remaining_dirs:
        print("⚠️  Remaining temp directories:", remaining_dirs)
    else:
        print("✨ All temporary directories cleaned!")

if __name__ == "__main__":
    cleanup_all_temp_files()