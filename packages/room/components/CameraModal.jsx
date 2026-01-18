import React, { useState, useRef, useEffect } from "react";
import { X, Camera, RefreshCw } from "lucide-react";

export function CameraModal({ isOpen, onClose, onCapture }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          // Create a File object from the blob to match existing logic
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
          onCapture(file);
          onClose();
        }
      },
      "image/jpeg",
      0.9
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Prendre une photo
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="aspect-video bg-black flex items-center justify-center relative">
          {error ? (
            <div className="text-center p-6">
              <p className="text-mondrian-red mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" /> Réessayer
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Controls */}
        <div className="p-8 flex justify-center bg-neutral-900">
          {!error && (
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group hover:scale-105 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-white group-active:scale-90 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
