import { useState, useRef } from "react";
import { MdOutlineExitToApp, MdOutlineDownload, MdRefresh } from "react-icons/md";
import "aframe";

export default function Home() {
  const [videoURL, setVideoURL] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoURL(url);
    }
  };

const startRecording = () => {
  const canvas = document.querySelector("canvas"); // A-Frame canvas
  const videoEl = videoRef.current;

  if (!canvas || !videoEl) return alert("VR scene not loaded yet!");

  // Capture video from canvas
  const canvasStream = canvas.captureStream(30);

  // Capture audio from video element
  let audioStream;
  if (videoEl.captureStream) {
    audioStream = videoEl.captureStream();
  } else if (videoEl.mozCaptureStream) {
    audioStream = videoEl.mozCaptureStream();
  }

  // Merge canvas + audio tracks
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioStream ? audioStream.getAudioTracks() : []),
  ]);

  const recorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });

  chunksRef.current = [];
  recorder.ondataavailable = (e) => chunksRef.current.push(e.data);

  recorder.onstop = () => {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "vr180-output.webm"; // VR video + audio
    a.click();

    setIsRecording(false);
  };

  recorder.start();
  recorderRef.current = recorder;
  setIsRecording(true);
};

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const handleExit = () => {
    setVideoURL(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    stopRecording();
  };

  const handleResetView = () => {
    const scene = document.querySelector("a-scene");
    if (scene) {
      scene.camera.el.setAttribute("rotation", "0 0 0");
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-100 to-gray-200">
      {/* Main container */}
      <div className="flex flex-col items-center justify-center flex-grow p-6">
        <div className="max-w-3xl w-full bg-white shadow-lg rounded-2xl p-8">
          <h1 className="text-3xl font-extrabold text-center mb-6 text-gray-800">
            🎥 VR180 Immersive Video Demo
          </h1>

          {/* Upload */}
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
            <span className="text-gray-600 font-medium">
              Click or drag video file here
            </span>
            <input
              type="file"
              accept="video/*"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          {/* VR Scene */}
          {videoURL && (
            <div className="w-full h-[480px] border rounded-xl overflow-hidden relative mt-6">
              {/* Utility buttons */}
              <div className="absolute top-4 right-4 flex gap-3 z-10">
                <button
                  onClick={handleResetView}
                  className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-600 shadow-md transition"
                  title="Reset View"
                >
                  <MdRefresh size={22} />
                </button>

                {/* Record / Stop button */}
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 shadow-md transition"
                    title="Start Recording VR Video"
                  >
                    <MdOutlineDownload size={22} />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="p-2 rounded-full bg-yellow-600 text-white hover:bg-yellow-700 shadow-md transition animate-pulse"
                    title="Stop Recording & Download"
                  >
                    ⏹
                  </button>
                )}

                <button
                  onClick={handleExit}
                  className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-md transition"
                  title="Exit"
                >
                  <MdOutlineExitToApp size={22} />
                </button>
              </div>

              <a-scene
                embedded
                vr-mode-ui="enabled: true"
                style={{ width: "100%", height: "100%" }}
              >
                {/* Video asset */}
                <video
                  id="videoLeft"
                  src={videoURL}
                  autoPlay
                  loop
                  crossOrigin="anonymous"
                  playsInline
                  ref={videoRef}
                />
                <video
                  id="videoRight"
                  src={videoURL}
                  autoPlay
                  loop
                  crossOrigin="anonymous"
                  playsInline
                />

                {/* Fake stereo: two spheres slightly shifted */}
                <a-entity stereo="eye:left">
                  <a-videosphere
                    src="#videoLeft"
                    rotation="0 -90 0"
                    scale="1 1 -1"
                  ></a-videosphere>
                </a-entity>

                <a-entity stereo="eye:right">
                  <a-videosphere
                    src="#videoRight"
                    rotation="0 -90 0"
                    scale="1 1 -1"
                  ></a-videosphere>
                </a-entity>

                {/* Camera */}
                <a-entity camera look-controls position="0 1.6 0"></a-entity>
              </a-scene>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-gray-900 text-gray-300 py-4 text-center text-sm">
        <span className="font-semibold text-white">2Dto180Exp</span> — Built by{" "}
        <a
          href="https://github.com/Jaydeeprawat17"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          Jaydeep Rawat
        </a>
      </footer>
    </main>
  );
}
