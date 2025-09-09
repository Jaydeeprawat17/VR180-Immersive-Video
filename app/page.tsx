"use client";

import { useState, useRef } from "react";
import { MdOutlineExitToApp, MdOutlineDownload } from "react-icons/md";

import "aframe";

// Extend A-Frame elements for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "a-scene": any;
      "a-videosphere": any;
      "a-entity": any;
    }
  }
}

export default function Home() {
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoURL(url);
    }
  };

  const handleDownload = () => {
    if (!videoURL) return;
    const a = document.createElement("a");
    a.href = videoURL;
    a.download = "vr180-video.mp4";
    a.click();
  };

  const handleExit = () => {
    setVideoURL(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
  };

  const handleResetView = () => {
    const scene = document.querySelector("a-scene");
    if (scene) {
      (scene as any).camera.el.setAttribute("rotation", "0 0 0");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="max-w-3xl w-full bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6">
          🎥 VR180 Immersive Video Demo
        </h1>

        {/* Upload */}
        <input
          type="file"
          accept="video/*"
          onChange={handleFile}
          className="mb-4 w-full border p-2"
        />

        {/* VR Scene */}
        {videoURL && (
          <div
            className="w-full h-[480px] border rounded overflow-hidden relative bottom-[ 270px]
    left-[470px]"
          >
            {/* Utility buttons */}
            <div className="absolute top-2 right-2 flex gap-2 z-10">
              <button
                onClick={handleResetView}
                className=" text-gray-200 text-2xl px-2 py-1 rounded hover:bg-gray-600"
              >
                <MdOutlineExitToApp />
              </button>
              <button
                onClick={handleDownload}
                className=" text-gray-200 text-2xl px-2 py-1 rounded hover:bg-green-700"
              >
                <MdOutlineDownload />
              </button>
              <button
                onClick={handleExit}
                className=" text-gray-200 text-2xl px-2 py-1 rounded hover:bg-red-700"
              >
                <MdOutlineExitToApp />
              </button>
            </div>

            <a-scene
              data-embedded="true"
              data-vr-mode-ui="enabled: true"
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
    </main>
  );
}
