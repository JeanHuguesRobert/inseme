import React from "react";
import { Chat } from "@inseme/room";
import { MondrianBlock } from "../utils/uiUtils";
import AttachmentPreview from "./AttachmentPreview";
import OpheliaInputArea from "./OpheliaInputArea";

const OpheliaScreen = ({
  context,
  isMobile,
  attachment,
  text,
  onTextChange,
  onSend,
  onAttach,
  onAttachCamera,
  onAttachGallery,
  onClearAttachment,
  onTip,
  onSuspendu,
  onInvite,
  onAfter,
  isAfter,
}) => {
  return (
    <div className="h-full flex flex-col pt-4 px-4 pb-4 text-black transition-colors duration-1000 overflow-hidden relative">
      {isAfter && (
        <div className="absolute inset-0 bg-mondrian-black z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent_70%)]" />
          <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
        </div>
      )}

      <MondrianBlock
        color={isAfter ? "black" : "white"}
        className={`flex-1 border-8 ${isAfter ? "border-mondrian-blue/50 shadow-[0px_20px_50px_rgba(0,0,0,0.2)]" : "border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"} flex flex-col transition-all duration-1000 overflow-hidden relative z-10 backdrop-blur-sm`}
      >
        {attachment && (
          <AttachmentPreview
            attachment={attachment}
            onClearAttachment={onClearAttachment}
            onSend={onSend}
          />
        )}

        <div
          className={`flex-1 overflow-hidden relative ${isAfter ? "bg-black" : "bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]"}`}
        >
          <Chat
            variant="minimal"
            className={`h-full p-4 ${isAfter ? "text-mondrian-blue" : "text-black"}`}
          />
        </div>

        <OpheliaInputArea
          text={text}
          onTextChange={onTextChange}
          onSend={onSend}
          attachment={attachment}
          context={context}
          isMobile={isMobile}
          onAttach={onAttach}
          onAttachCamera={onAttachCamera}
          onAttachGallery={onAttachGallery}
          onTip={onTip}
          onSuspendu={onSuspendu}
          onInvite={onInvite}
          onAfter={onAfter}
          isAfter={isAfter}
        />
      </MondrianBlock>
    </div>
  );
};

export default OpheliaScreen;
