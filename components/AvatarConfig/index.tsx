import React, { useMemo, useState } from "react";
import {
  AvatarQuality,
  ElevenLabsModel,
  STTProvider,
  VoiceEmotion,
  StartAvatarRequest,
  VoiceChatTransport,
} from "@heygen/streaming-avatar";

import { Input } from "../Input";
import { Select } from "../Select";

import { Field } from "./Field";

import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

interface AvatarConfigProps {
  onConfigChange: (config: StartAvatarRequest) => void;
  config: StartAvatarRequest;
}

export const AvatarConfig: React.FC<AvatarConfigProps> = ({
  onConfigChange,
  config,
}) => {
  const onChange = <T extends keyof StartAvatarRequest>(
    key: T,
    value: StartAvatarRequest[T],
  ) => {
    onConfigChange({ ...config, [key]: value });
  };
  const [showMore, setShowMore] = useState<boolean>(false);

  const DEFAULT_CONFIG: StartAvatarRequest = {
    quality: AvatarQuality.High,
    avatarName: "433e2032e1654e07abec5a255d098968",
    knowledgeId: "fa86fe2bd2f047f69afcacba93beef23",
    voice: {
      rate: 1.0,
      emotion: VoiceEmotion.EXCITED,
      model: ElevenLabsModel.eleven_flash_v2_5,
    },
    language: "ru",
    disableIdleTimeout: true,
    voiceChatTransport: VoiceChatTransport.LIVEKIT,
    sttSettings: {
      provider: STTProvider.DEEPGRAM,
    },
  };

  return (
    <div className="relative flex flex-col gap-4 w-[550px] py-8 max-h-full overflow-y-auto px-4">
      {/*
      <Field label="Custom Knowledge Base ID">
        <Input
          placeholder="Enter custom knowledge base ID"
          value={config.knowledgeId}
          onChange={(value) => onConfigChange({ ...config, knowledgeId: value })}
        />
      </Field>
        <Field label="Custom Avatar ID">
          <Input
            placeholder="Enter custom avatar ID"
          value={config.avatar_id}
          onChange={(value) => onConfigChange({ ...config, avatar_id: value })}
        />
      </Field>
      */}
    </div>
  );
};
