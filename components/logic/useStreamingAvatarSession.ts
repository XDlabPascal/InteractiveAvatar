import StreamingAvatar, {
  ConnectionQuality,
  StartAvatarRequest,
  StreamingEvents,
} from "@heygen/streaming-avatar";
import { useCallback, useRef } from "react";

import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";
import { useVoiceChat } from "./useVoiceChat";
import { useMessageHistory } from "./useMessageHistory";

export const useStreamingAvatarSession = () => {
  const {
    avatarRef,
    basePath,
    sessionState,
    setSessionState,
    stream,
    setStream,
    setIsListening,
    setIsUserTalking,
    setIsAvatarTalking,
    setConnectionQuality,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    clearMessages,
  } = useStreamingAvatarContext();
  const { stopVoiceChat } = useVoiceChat();

  useMessageHistory();

  const performanceMetrics = useRef(new Map<string, number>());
  const sessionStartTime = useRef(0);

  const logPerformance = useCallback((operation: string) => {
    const now = performance.now();
    const duration = now - sessionStartTime.current;
    performanceMetrics.current.set(operation, duration);
    console.log(`Session Performance [${operation}]: ${duration.toFixed(2)}ms`);
  }, []);

  const init = useCallback(
    (token: string) => {
      sessionStartTime.current = performance.now();
      logPerformance('Session start');
      
      avatarRef.current = new StreamingAvatar({
        token,
        basePath: basePath,
      });

      logPerformance('Avatar initialization');
      return avatarRef.current;
    },
    [basePath, avatarRef, logPerformance],
  );

  const handleStream = useCallback(
    ({ detail }: { detail: MediaStream }) => {
      setStream(detail);
      setSessionState(StreamingAvatarSessionState.CONNECTED);
      logPerformance('Stream ready');
    },
    [setSessionState, setStream, logPerformance],
  );

  const stop = useCallback(async () => {
    try {
      logPerformance('Stopping session');
      
      avatarRef.current?.off(StreamingEvents.STREAM_READY, handleStream);
      avatarRef.current?.off(StreamingEvents.STREAM_DISCONNECTED, stop);
      
      clearMessages();
      await stopVoiceChat();
      setIsListening(false);
      setIsUserTalking(false);
      setIsAvatarTalking(false);
      
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
      
      setStream(null);
      await avatarRef.current?.stopAvatar();
      setSessionState(StreamingAvatarSessionState.INACTIVE);
      
      logPerformance('Session stopped');
      
      // Логируем все метрики производительности
      console.log('Session Performance Metrics:', 
        Object.fromEntries(performanceMetrics.current));
    } catch (error) {
      console.error('Error stopping session:', error);
      // Принудительно сбрасываем состояние при ошибке
      setSessionState(StreamingAvatarSessionState.INACTIVE);
      setStream(null);
    }
  }, [
    handleStream,
    setSessionState,
    setStream,
    avatarRef,
    setIsListening,
    stopVoiceChat,
    clearMessages,
    setIsUserTalking,
    setIsAvatarTalking,
    stream,
    logPerformance,
  ]);

  const start = useCallback(
    async (config: StartAvatarRequest, token?: string) => {
      try {
        if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
          throw new Error("There is already an active session");
        }

        if (!avatarRef.current) {
          if (!token) {
            throw new Error("Token is required");
          }
          init(token);
        }

        if (!avatarRef.current) {
          throw new Error("Avatar is not initialized");
        }

        setSessionState(StreamingAvatarSessionState.CONNECTING);
        logPerformance('Session connecting');

        // Регистрируем обработчики событий
        const eventHandlers = {
          [StreamingEvents.STREAM_READY]: handleStream,
          [StreamingEvents.STREAM_DISCONNECTED]: stop,
          [StreamingEvents.CONNECTION_QUALITY_CHANGED]: ({ detail }: { detail: ConnectionQuality }) => {
            setConnectionQuality(detail);
            logPerformance('Connection quality changed');
          },
          [StreamingEvents.USER_START]: () => {
            setIsUserTalking(true);
            logPerformance('User started talking');
          },
          [StreamingEvents.USER_STOP]: () => {
            setIsUserTalking(false);
            logPerformance('User stopped talking');
          },
          [StreamingEvents.AVATAR_START_TALKING]: () => {
            setIsAvatarTalking(true);
            logPerformance('Avatar started talking');
          },
          [StreamingEvents.AVATAR_STOP_TALKING]: () => {
            setIsAvatarTalking(false);
            logPerformance('Avatar stopped talking');
          },
          [StreamingEvents.USER_TALKING_MESSAGE]: handleUserTalkingMessage,
          [StreamingEvents.AVATAR_TALKING_MESSAGE]: handleStreamingTalkingMessage,
          [StreamingEvents.USER_END_MESSAGE]: handleEndMessage,
          [StreamingEvents.AVATAR_END_MESSAGE]: handleEndMessage,
        };

        Object.entries(eventHandlers).forEach(([event, handler]) => {
          avatarRef.current?.on(event as StreamingEvents, handler);
        });

        await avatarRef.current.createStartAvatar(config);
        logPerformance('Avatar created and started');

        return avatarRef.current;
      } catch (error) {
        console.error('Error starting session:', error);
        setSessionState(StreamingAvatarSessionState.INACTIVE);
        throw error;
      }
    },
    [
      sessionState,
      avatarRef,
      init,
      setSessionState,
      handleStream,
      stop,
      setConnectionQuality,
      setIsUserTalking,
      setIsAvatarTalking,
      handleUserTalkingMessage,
      handleStreamingTalkingMessage,
      handleEndMessage,
      logPerformance,
    ],
  );

  return {
    initAvatar: init,
    startAvatar: start,
    stopAvatar: stop,
    sessionState,
    stream,
  };
};
