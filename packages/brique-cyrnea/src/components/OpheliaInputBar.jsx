import React from "react";
import { Icon } from "./Icon";
import { TalkButton } from "@inseme/room";

const OpheliaInputBar = ({ text, onTextChange, onSend, attachment, context }) => {
  const tags = [
    {
      id: "@barman",
      label: "Barman",
      icon: () => <Icon name="coffee" />,
      color: "bg-mondrian-red",
    },
    {
      id: "@clients",
      label: "Clients",
      icon: () => <Icon name="users" />,
      color: "bg-mondrian-yellow",
    },
    {
      id: "@equipe",
      label: "Équipe",
      icon: () => <Icon name="briefcase" />,
      color: "bg-mondrian-blue",
    },
  ];

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex gap-2 px-1">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => {
              if (text.includes(tag.id)) {
                onTextChange(text.replace(tag.id, "").trim());
              } else {
                onTextChange(`${tag.id} ${text}`.trim());
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 border-2 border-black text-[8px] font-black uppercase tracking-tighter transition-all ${
              text.includes(tag.id)
                ? `${tag.color} text-white translate-y-0.5 shadow-none`
                : "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none"
            }`}
          >
            <tag.icon className="w-2.5 h-2.5" />
            {tag.label}
          </button>
        ))}
      </div>

      <div className="w-full flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Tapez un message..."
            className="w-full bg-white border-4 border-black p-3 font-black text-xs focus:ring-0 focus:outline-none placeholder:text-black/30 pr-12"
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <div className="absolute right-1 top-1 bottom-1 flex items-center gap-1">
            <TalkButton
              size="sm"
              showLabel={false}
              vocalState={context.vocalState}
              isRecording={context.isRecording}
              isTranscribing={context.isTranscribing}
              vocalError={context.vocalError}
              transcriptionPreview={context.transcriptionPreview}
              duration={context.duration}
              startRecording={context.startRecording}
              stopRecording={context.stopRecording}
              isHandsFree={context.isHandsFree}
              microMode={context.microMode}
              onMicroModeChange={context.changeMicroMode}
              className="border-0 shadow-none hover:shadow-none translate-x-0 translate-y-0 hover:translate-x-0 hover:translate-y-0"
            />
            <button
              onClick={onSend}
              disabled={!text && !attachment}
              className={`px-3 h-full border-l-4 border-black flex items-center justify-center transition-colors ${
                text || attachment ? "bg-mondrian-red text-white" : "text-black/20"
              }`}
            >
              <Icon name="send" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpheliaInputBar;
