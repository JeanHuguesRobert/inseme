import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Camera } from "react-camera-pro";

/**
 * PersistentCamera
 *
 * Ce composant est conçu pour être monté une seule fois au niveau de l'application.
 * Il maintient le flux caméra actif (warm) pour éviter les délais d'initialisation.
 */
const PersistentCamera = forwardRef(({ active = false }, ref) => {
  const cameraRef = useRef(null);
  const [numberOfCameras, setNumberOfCameras] = useState(0);
  const [facingMode, setFacingMode] = useState("environment");
  const [error, setError] = useState(null);

  // Exposer les méthodes à travers le ref
  useImperativeHandle(ref, () => ({
    takePhoto: () => {
      if (cameraRef.current) {
        return cameraRef.current.takePhoto();
      }
      return null;
    },
    switchCamera: () => {
      if (cameraRef.current) {
        cameraRef.current.switchCamera();
        setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
      }
    },
    numberOfCameras,
  }));

  const _handleError = useCallback((err) => {
    console.error("[PersistentCamera] Erreur:", err);
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      setError("Permission refusée. Veuillez autoriser la caméra.");
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      setError("Aucune caméra détectée.");
    } else {
      setError("Erreur caméra: " + (err.message || "Inconnue"));
    }
  }, []);

  return (
    <div
      id="persistent-camera-container"
      className={`fixed inset-0 z-[190] pointer-events-none transition-opacity duration-300 ${active ? "opacity-100 bg-black/60 backdrop-blur-sm" : "opacity-0"}`}
    >
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center p-4 ${active ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        {/*
                    Le "trou" ou le cadre est géré par CameraModal.
                    Ici on affiche juste le flux dans un cadre fixe qui correspond au modal.
                */}
        <div className="relative w-full max-w-md aspect-square border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-blue)] overflow-hidden bg-slate-900">
          <Camera
            ref={cameraRef}
            aspectRatio="cover"
            facingMode={facingMode}
            numberOfCamerasCallback={setNumberOfCameras}
            errorMessages={{
              noCameraAccessible: "Pas de caméra accessible.",
              permissionDenied: "Permission refusée.",
            }}
          />

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center font-black uppercase">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PersistentCamera;
