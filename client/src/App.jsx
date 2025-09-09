import { useState, useRef, useEffect } from "react";
import {
  MdOutlineExitToApp,
  MdOutlineDownload,
  MdRefresh,
} from "react-icons/md";
import "aframe";

export default function Home() {
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);

  // Poll for progress updates
  useEffect(() => {
    if (!jobId) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`http://localhost:4040/progress/${jobId}`);
        const data = await response.json();
        setProgress(data);

        if (data.status === "completed") {
          // Wait a moment for file to be fully written, then set video URL
          setTimeout(() => {
            setVideoUrl(`http://localhost:4040/videos/${data.fileName}`);
            setJobId(null);
            setLoading(false);
          }, 1000);
        } else if (data.status === "error") {
          setJobId(null);
          setLoading(false);
          alert("Processing failed: " + data.message);
        }
      } catch (error) {
        console.error("Error polling progress:", error);
      }
    };

    const interval = setInterval(pollProgress, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [jobId]);

  const handleUpload = async () => {
    if (!file) return alert("Please select a video first");

    const formData = new FormData();
    formData.append("video", file);

    try {
      setLoading(true);
      setVideoUrl(null);
      setProgress(null);

      const response = await fetch("http://localhost:4040/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.jobId) {
        setJobId(data.jobId);
        setProgress({
          step: "starting",
          message: "Upload complete, processing...",
          progress: 0,
        });
      } else {
        throw new Error("No job ID received");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Something went wrong!");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setJobId(null);
    setProgress(null);
    setVideoUrl(null);
    setLoading(false);
  };

  return (
    <div className="p-6 text-center max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🎬 VR 180 Converter</h1>

      {/* Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="mb-4"
        />

        {file && (
          <p className="text-sm text-gray-600 mb-4">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className={`px-6 py-3 rounded-lg font-medium ${
            !file || loading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {loading ? "Processing..." : "Upload & Convert to VR 180°"}
        </button>
      </div>

      {/* Progress Section */}
      {progress && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-bold mb-4">Processing Progress</h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg">{progress.message}</span>
              <span className="text-lg font-bold">{progress.progress}%</span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-300 ${
                  progress.status === "error"
                    ? "bg-red-500"
                    : progress.status === "completed"
                    ? "bg-green-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${progress.progress}%` }}
              ></div>
            </div>

            <div className="text-sm text-gray-600">
              Step: {progress.step} | Status: {progress.status}
            </div>
          </div>
        </div>
      )}

      {/* Video Result Section */}
      {videoUrl && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">
            🎯 Your VR 180° Video is Ready!
          </h2>

          {/* Debug Info */}
          <div className="bg-gray-50 p-4 rounded mb-4 text-left">
            <p className="text-sm text-gray-600">
              <strong>Video URL:</strong> {videoUrl}
            </p>
            <div className="mt-2">
              <button
                onClick={() => {
                  const video = document.querySelector("video");
                  if (video) {
                    video.load();
                    video.play();
                  }
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm mr-2"
              >
                🔄 Reload
              </button>

              <button
                onClick={async () => {
                  const filename = videoUrl.split("/").pop();
                  try {
                    const response = await fetch(
                      `http://localhost:4040/test-video/${filename}`
                    );
                    const data = await response.json();
                    if (data.exists) {
                      alert(
                        `✅ Video exists! Size: ${(
                          data.size /
                          1024 /
                          1024
                        ).toFixed(2)} MB`
                      );
                    } else {
                      alert("❌ Video file not found on server!");
                    }
                  } catch (error) {
                    alert("Failed to test video file");
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                🧪 Test File
              </button>
            </div>
          </div>

          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="w-full max-w-4xl rounded shadow-lg"
            onError={(e) => {
              console.error("Video error:", e);
              alert(
                "Video failed to load. Try clicking 'Test File' to check if it exists."
              );
            }}
            onLoadStart={() => console.log("Video load started")}
            onLoadedData={() => console.log("Video loaded successfully")}
          >
            Your browser does not support the video tag.
          </video>

          <div className="mt-6 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800">
                <strong>🥽 VR Viewing:</strong> For best VR experience, download
                this video and view it in a VR headset using VLC VR, YouTube VR,
                or your headset's video player.
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              <a
                href={videoUrl}
                download
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                📥 Download VR Video
              </a>

              <button
                onClick={resetForm}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                🔄 Convert Another Video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
