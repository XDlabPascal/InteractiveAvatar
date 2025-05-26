import { useCallback, useRef } from "react";

import { useStreamingAvatarContext } from "./context";

export const useVoiceChat = () => {
  const {
    avatarRef,
    isMuted,
    setIsMuted,
    isVoiceChatActive,
    setIsVoiceChatActive,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
  } = useStreamingAvatarContext();

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  const startVoiceChat = useCallback(
    async (isInputAudioMuted?: boolean) => {
      if (!avatarRef.current) return;
      
      try {
        setIsVoiceChatLoading(true);
        retryCountRef.current = 0;
        
        await avatarRef.current?.startVoiceChat({
          isInputAudioMuted,
        });
        
        setIsVoiceChatLoading(false);
        setIsVoiceChatActive(true);
        setIsMuted(!!isInputAudioMuted);
      } catch (error) {
        console.error('Error starting voice chat:', error);
        
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log(`Retrying voice chat start (${retryCountRef.current}/${MAX_RETRIES})...`);
          
          setTimeout(() => {
            startVoiceChat(isInputAudioMuted);
          }, RETRY_DELAY);
        } else {
          setIsVoiceChatLoading(false);
          throw error;
        }
      }
    },
    [avatarRef, setIsMuted, setIsVoiceChatActive, setIsVoiceChatLoading],
  );

  const stopVoiceChat = useCallback(async () => {
    if (!avatarRef.current) return;
    
    try {
      await avatarRef.current?.closeVoiceChat();
      setIsVoiceChatActive(false);
      setIsMuted(true);
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Error stopping voice chat:', error);
      setIsVoiceChatActive(false);
      setIsMuted(true);
    }
  }, [avatarRef, setIsMuted, setIsVoiceChatActive]);

  const muteInputAudio = useCallback(async () => {
    if (!avatarRef.current) return;
    
    try {
      await avatarRef.current?.muteInputAudio();
      setIsMuted(true);
    } catch (error) {
      console.error('Error muting input audio:', error);
      setIsMuted(true);
    }
  }, [avatarRef, setIsMuted]);

  const unmuteInputAudio = useCallback(async () => {
    if (!avatarRef.current) return;
    
    try {
      await avatarRef.current?.unmuteInputAudio();
      setIsMuted(false);
    } catch (error) {
      console.error('Error unmuting input audio:', error);
      setIsMuted(false);
    }
  }, [avatarRef, setIsMuted]);

  return {
    startVoiceChat,
    stopVoiceChat,
    muteInputAudio,
    unmuteInputAudio,
    isMuted,
    isVoiceChatActive,
    isVoiceChatLoading,
  };
};
