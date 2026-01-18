// FundingWidget.jsx
// Displays a progress bar for the next feature and a donation button.
import React, { useState, useEffect } from "react";
import { Button } from "@inseme/ui";
import { MondrianBlock } from "@inseme/room";

const FundingWidget = ({
  progress: initialProgress = 0.8,
  goal = "Talkie‑Walkie Vocale",
  donationUrl = "https://buymeacoffee.com/yourproject",
}) => {
  const [localFunding, setLocalFunding] = useState(() => {
    const saved = localStorage.getItem("inseme_barman_funding");
    return saved ? JSON.parse(saved) : { progress: initialProgress, tipsCount: 0 };
  });
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    localStorage.setItem("inseme_barman_funding", JSON.stringify(localFunding));
  }, [localFunding]);

  // Listen for tip events to update local funding progress
  useEffect(() => {
    const handleInsemeEvent = (e) => {
      if (e.detail?.type === "tip") {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 2000);
        setLocalFunding((prev) => ({
          ...prev,
          progress: Math.min(1, prev.progress + 0.01),
          tipsCount: prev.tipsCount + 1,
        }));
      }
      if (e.detail?.type === "last_call") {
        // Visual feedback for last call
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 500);
      }
    };
    window.addEventListener("inseme:event", handleInsemeEvent);
    return () => window.removeEventListener("inseme:event", handleInsemeEvent);
  }, []);

  const percent = Math.round(localFunding.progress * 100);
  return (
    <MondrianBlock
      color={showFlash ? "yellow" : "white"}
      className={`border-4 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden transition-colors duration-300 ${showFlash ? "animate-bounce" : ""}`}
    >
      {showFlash && (
        <div className="absolute inset-0 bg-mondrian-yellow flex items-center justify-center z-10 animate-pulse">
          <span className="text-xl font-black italic text-black uppercase tracking-tighter">
            MERCI ! 🍻
          </span>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-mondrian-red">
            Objectif {goal}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="bg-black text-white px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="text-[10px] font-black italic">{localFunding.tipsCount}</span>
              <span className="text-[8px] font-black uppercase tracking-tighter opacity-70">
                TIPS
              </span>
            </div>
          </div>
        </div>
        <span className="text-lg font-black italic text-mondrian-red">{percent}%</span>
      </div>
      <div className="w-full bg-mondrian-yellow h-3 mb-3 border-2 border-black">
        <div className="bg-mondrian-red h-full" style={{ width: `${percent}%` }}></div>
      </div>
      <Button
        className="w-full bg-black text-white font-black uppercase hover:bg-mondrian-red transition-colors"
        onClick={() => window.open(donationUrl, "_blank")}
      >
        Offrez un coup à boire aux dev'
      </Button>
    </MondrianBlock>
  );
};

export default FundingWidget;
