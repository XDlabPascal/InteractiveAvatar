import React, { forwardRef, useEffect } from "react";
import { ConnectionQuality } from "@heygen/streaming-avatar";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { StreamingAvatarSessionState } from "../logic";
import { CloseIcon } from "../Icons";
import { Button } from "../Button";

export const AvatarVideo = forwardRef<HTMLVideoElement>(({}, ref) => {
  const { sessionState, stopAvatar } = useStreamingAvatarSession();
  const { connectionQuality } = useConnectionQuality();

  const isLoaded = sessionState === StreamingAvatarSessionState.CONNECTED;

  // Очистка медиапотока при размонтировании
  useEffect(() => {
    return () => {
      if (ref && 'current' in ref && ref.current) {
        const videoElement = ref.current as HTMLVideoElement;
        if (videoElement.srcObject) {
          const tracks = (videoElement.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          videoElement.srcObject = null;
        }
      }
    };
  }, [ref]);

  // Оптимизация воспроизведения видео
  useEffect(() => {
    if (ref && 'current' in ref && ref.current) {
      const videoElement = ref.current as HTMLVideoElement;
      
      // Добавляем обработчики для оптимизации производительности
      videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play().catch(console.error);
      });

      // Обработка ошибок воспроизведения
      videoElement.addEventListener('error', (e) => {
        console.error('Video playback error:', e);
      });

      // Обработка буферизации
      videoElement.addEventListener('waiting', () => {
        console.log('Video is buffering...');
      });

      videoElement.addEventListener('playing', () => {
        console.log('Video is playing');
      });
    }
  }, [ref]);

  return (
    <>
      {connectionQuality !== ConnectionQuality.UNKNOWN && (
        <div className="absolute top-3 left-3 bg-black text-white rounded-lg px-3 py-2">
          Connection Quality: {connectionQuality}
        </div>
      )}
      {isLoaded && (
        <Button
          className="absolute top-3 right-3 !p-2 bg-zinc-700 bg-opacity-50 z-10"
          onClick={stopAvatar}
        >
          <CloseIcon />
        </Button>
      )}
      <video
        ref={ref}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
        preload="auto"
      >
        <track kind="captions" />
      </video>
      {!isLoaded && (
        <div className="w-full h-full flex items-center justify-center absolute top-0 left-0">
          Loading...
        </div>
      )}
    </>
  );
});
AvatarVideo.displayName = "AvatarVideo";
