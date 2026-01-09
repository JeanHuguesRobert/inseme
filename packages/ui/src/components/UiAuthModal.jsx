import React from "react";
import { X } from "lucide-react";
import Login from "./Login";

export default function AuthModal({
  onClose,
  onSignInAnonymously,
  onSignInWithProvider,
  onSignInWithPassword,
  onSignUp,
  onSpectator,
  loading,
  error,
  roomName,
  isUpgrading = false,
  initialMode = null,
  showAnonymous = true,
  showProviders = true,
  labels,
  sidebar,
  maxWidth = "max-w-lg",
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className={`relative w-full ${maxWidth} bg-white rounded-[2.5rem] shadow-2xl shadow-black/20 overflow-hidden animate-in zoom-in-95 duration-300`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all z-20"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col md:flex-row h-full">
          {/* Main Content */}
          <div
            className={`w-full ${sidebar ? "md:w-1/2" : "w-full"} p-8 md:p-12 overflow-y-auto`}
          >
            <Login
              onSignInAnonymously={onSignInAnonymously}
              onSignInWithProvider={onSignInWithProvider}
              onSignInWithPassword={onSignInWithPassword}
              onSignUp={onSignUp}
              onSpectator={onSpectator}
              loading={loading}
              error={error}
              roomName={roomName}
              isUpgrading={isUpgrading}
              initialMode={initialMode}
              showAnonymous={showAnonymous}
              showProviders={showProviders}
              labels={labels}
            />
          </div>

          {/* Sidebar */}
          {sidebar && <div className="hidden md:flex md:w-1/2">{sidebar}</div>}
        </div>
      </div>
    </div>
  );
}
