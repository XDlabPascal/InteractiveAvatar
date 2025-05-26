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
import { AccessCodeModal } from "./AccessCodeModal";

import { AVATARS } from "@/app/lib/constants";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Medium,
  avatarName: "433e2032e1654e07abec5a255d098968",
  knowledgeId: "072e7c65ff9e4762ad63bfe1f34d9440",
  voice: {
    voiceId: "81bb7c1a521442f6b812b2294a29acc1",
    rate: 1.0,
    emotion: VoiceEmotion.EXCITED,
  },
  language: "ru",
  disableIdleTimeout: true,
  voiceChatTransport: VoiceChatTransport.LIVEKIT,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
    confidence: 0.8,
    useSilencePrompt: false,
  }
};

const performanceMetrics = {
  startTime: 0,
  endTime: 0,
  operations: new Map<string, number>(),
};

const logPerformance = (operation: string) => {
  const now = performance.now();
  const duration = now - performanceMetrics.startTime;
  performanceMetrics.operations.set(operation, duration);
  console.log(`Performance [${operation}]: ${duration.toFixed(2)}ms`);
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
  const [isCodeVerified, setIsCodeVerified] = useState(false);

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
      performanceMetrics.startTime = performance.now();
      resetReconnectState();
      setIsDialogComplete(false);
      
      console.log("Starting session with config:", JSON.stringify(config, null, 2));
      const newToken = await fetchAccessToken();
      logPerformance("Token fetch");
      
      const avatar = initAvatar(newToken);
      logPerformance("Avatar initialization");

      const eventHandlers = {
        [StreamingEvents.AVATAR_START_TALKING]: (e: any) => {
          console.log("Avatar started talking", e);
          logPerformance("Avatar start talking");
        },
        [StreamingEvents.AVATAR_STOP_TALKING]: (e: any) => {
          console.log("Avatar stopped talking", e);
          logPerformance("Avatar stop talking");
        },
        [StreamingEvents.STREAM_DISCONNECTED]: () => {
          console.log("Stream disconnected");
          handleConnectionError(new Error("Stream disconnected"));
        },
        [StreamingEvents.STREAM_READY]: (event: any) => {
          console.log(">>>>> Stream ready:", event.detail);
          logPerformance("Stream ready");
          resetReconnectState();
        },
        [StreamingEvents.USER_START]: (event: any) => {
          console.log(">>>>> User started talking:", event);
          logPerformance("User start talking");
        },
        [StreamingEvents.USER_STOP]: (event: any) => {
          console.log(">>>>> User stopped talking:", event);
          logPerformance("User stop talking");
        },
        [StreamingEvents.USER_END_MESSAGE]: (event: any) => {
          console.log(">>>>> User end message:", event);
          if (event.detail?.text && checkForEndCommand(event.detail.text)) {
            handleDialogComplete();
          }
          logPerformance("User end message");
        },
        [StreamingEvents.USER_TALKING_MESSAGE]: (event: any) => {
          console.log(">>>>> User talking message:", event);
          if (event.detail?.text && checkForEndCommand(event.detail.text)) {
            handleDialogComplete();
          }
          logPerformance("User talking message");
        },
        [StreamingEvents.AVATAR_TALKING_MESSAGE]: (event: any) => {
          console.log(">>>>> Avatar talking message:", event);
          logPerformance("Avatar talking message");
        },
        [StreamingEvents.AVATAR_END_MESSAGE]: (event: any) => {
          console.log(">>>>> Avatar end message:", event);
          logPerformance("Avatar end message");
        }
      };

      Object.entries(eventHandlers).forEach(([event, handler]) => {
        avatar.on(event as StreamingEvents, handler);
      });

      console.log("Starting avatar with config:", JSON.stringify(config, null, 2));
      await startAvatar(config);
      logPerformance("Avatar start");

      if (isVoiceChat) {
        console.log("Starting voice chat...");
        await startVoiceChat();
        logPerformance("Voice chat start");
      }

      performanceMetrics.endTime = performance.now();
      console.log("Total session initialization time:", 
        (performanceMetrics.endTime - performanceMetrics.startTime).toFixed(2), "ms");
      
    } catch (error) {
      console.error("Detailed error starting avatar session:", {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        config: JSON.stringify(config, null, 2),
        isVoiceChat,
        performanceMetrics: Object.fromEntries(performanceMetrics.operations)
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
      {!isCodeVerified && (
        <AccessCodeModal onCodeVerified={() => setIsCodeVerified(true)} />
      )}
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
