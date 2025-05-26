import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.High,
  avatarName: "June_HR_public",
  knowledgeId: "072e7c65ff9e4762ad63bfe1f34d9440",
  voice: {
    voiceId: "35c481f56a20457b98409dd72e5bc478"
  },
  version: "v2",
  video_encoding: "H264",
  language: "ru",
  disableIdleTimeout: true,
  voiceChatTransport: VoiceChatTransport.LIVEKIT,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
    confidence: 0.8
  }
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isDialogComplete, setIsDialogComplete] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY = 3000;
  const [isReconnecting, setIsReconnecting] = useState(false);

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);

  const mediaStream = useRef<HTMLVideoElement>(null);

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const handleDialogComplete = async () => {
    setIsDialogComplete(true);
    await stopAvatar();
  };

  const handleConnectionError = async (error: any) => {
    console.error("Connection error:", error);
    
    if (isReconnecting) {
      console.log("Already attempting to reconnect...");
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionError("Не удалось восстановить соединение. Пожалуйста, перезагрузите страницу.");
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    reconnectAttemptsRef.current += 1;
    setConnectionError(`Ошибка соединения. Попытка переподключения ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}...`);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      await stopAvatar();
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);
      await startAvatar(config);
      resetReconnectState();
    } catch (reconnectError) {
      console.error("Reconnection failed:", reconnectError);
      reconnectTimeoutRef.current = setTimeout(() => {
        handleConnectionError(reconnectError);
      }, RECONNECT_DELAY);
    }
  };

  const resetReconnectState = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = 0;
    setConnectionError(null);
    setIsReconnecting(false);
  };

  const handleManualReconnect = async () => {
    resetReconnectState();
    try {
      await stopAvatar();
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);
      await startAvatar(config);
    } catch (error) {
      handleConnectionError(error);
    }
  };

  const checkForEndCommand = (text: string) => {
    const endCommands = [
      "завершить диалог",
      "закончить диалог",
      "до свидания",
      "прощай",
      "завершить разговор",
      "закончить разговор",
      "пока",
      "всего доброго"
    ];
    
    const normalizedText = text.toLowerCase().trim();
    return endCommands.some(command => normalizedText.includes(command));
  };

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      resetReconnectState();
      setIsDialogComplete(false);
      console.log("Starting session with config:", JSON.stringify(config, null, 2));
      const newToken = await fetchAccessToken();
      console.log("Received token:", newToken);
      
      const avatar = initAvatar(newToken);
      console.log("Avatar initialized");

      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
        console.log("Avatar started talking", e);
      });
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
        console.log("Avatar stopped talking", e);
      });
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
        handleConnectionError(new Error("Stream disconnected"));
      });
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        console.log(">>>>> Stream ready:", event.detail);
        resetReconnectState();
      });
      avatar.on(StreamingEvents.USER_START, (event) => {
        console.log(">>>>> User started talking:", event);
      });
      avatar.on(StreamingEvents.USER_STOP, (event) => {
        console.log(">>>>> User stopped talking:", event);
      });
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
        console.log(">>>>> User end message:", event);
        if (event.detail?.text && checkForEndCommand(event.detail.text)) {
          handleDialogComplete();
        }
      });
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
        console.log(">>>>> User talking message:", event);
        if (event.detail?.text && checkForEndCommand(event.detail.text)) {
          handleDialogComplete();
        }
      });
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        console.log(">>>>> Avatar talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log(">>>>> Avatar end message:", event);
      });

      console.log("Starting avatar with config:", JSON.stringify(config, null, 2));
      await startAvatar(config);
      console.log("Avatar started successfully");

      if (isVoiceChat) {
        console.log("Starting voice chat...");
        await startVoiceChat();
        console.log("Voice chat started successfully");
      }
    } catch (error) {
      console.error("Detailed error starting avatar session:", {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        config: JSON.stringify(config, null, 2),
        isVoiceChat
      });
      handleConnectionError(error);
    }
  });

  useUnmount(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    stopAvatar();
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col rounded-xl bg-zinc-900 overflow-hidden">
        <div 
          ref={videoContainerRef}
          className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center"
        >
          {connectionError && (
            <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg z-20 flex flex-col gap-2">
              <div>{connectionError}</div>
              {reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS && (
                <button
                  onClick={handleManualReconnect}
                  className="bg-white text-red-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  disabled={isReconnecting}
                >
                  {isReconnecting ? "Переподключение..." : "Попробовать снова"}
                </button>
              )}
            </div>
          )}
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <>
              <AvatarVideo ref={mediaStream} />
              <button
                onClick={toggleFullscreen}
                className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg z-10"
              >
                {isFullscreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                )}
              </button>
            </>
          ) : (
            <AvatarConfig config={config} onConfigChange={setConfig} />
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <div className="flex flex-row gap-4">
              <AvatarControls />
              <Button onClick={handleDialogComplete}>
                Завершить диалог
              </Button>
            </div>
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSessionV2(true)} disabled={isReconnecting}>
                Start Voice Chat
              </Button>
              <Button onClick={() => startSessionV2(false)} disabled={isReconnecting}>
                Start Text Chat
              </Button>
            </div>
          ) : (
            <LoadingIcon />
          )}
        </div>
      </div>
      {sessionState === StreamingAvatarSessionState.CONNECTED && (
        <MessageHistory />
      )}
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}
