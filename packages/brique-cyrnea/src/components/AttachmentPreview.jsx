import React from "react";
import { Icon } from "./Icon";
import { MondrianBlock } from "../utils/uiUtils";

const AttachmentPreview = ({ attachment, onClearAttachment, onSend }) => {
  if (!attachment) return null;

  return (
    <div className="absolute top-14 left-4 z-50 w-32 h-32 border-8 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group">
      <img src={attachment.previewUrl} className="w-full h-full object-cover" alt="Capture" />
      <button
        onClick={onClearAttachment}
        className={`absolute -top-4 -right-4 bg-mondrian-red text-white border-4 border-black p-1 hover:bg-black`}
      >
        <Icon name="x" className="w-5 h-5" />
      </button>
      <button
        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-8 bg-black text-white border-4 border-black text-[10px] font-black uppercase"
        onClick={onSend}
      >
        Envoyer
      </button>
    </div>
  );
};

export default AttachmentPreview;
