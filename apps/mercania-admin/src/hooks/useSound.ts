import { useCallback } from 'react';

export const useSound = () => {
  // Create audio context for generating sounds
  const createAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      return new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext not supported:', error);
      return null;
    }
  }, []);

  // Generate a simple beep sound
  const playBeep = useCallback((frequency: number, duration: number, type: 'sine' | 'square' | 'triangle' = 'sine') => {
    const audioContext = createAudioContext();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;

    // Set volume envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }, [createAudioContext]);

  // Play success sound (two ascending chimes)
  const playSuccessSound = useCallback(() => {
    // First chime - higher pitch
    playBeep(800, 0.15, 'sine');
    
    // Second chime - even higher pitch, slightly delayed
    setTimeout(() => {
      playBeep(1000, 0.15, 'sine');
    }, 100);
  }, [playBeep]);

  // Play location success sound (two descending chimes)
  const playLocationSuccessSound = useCallback(() => {
    // First chime - higher pitch
    playBeep(600, 0.2, 'sine');
    
    // Second chime - lower pitch, slightly delayed
    setTimeout(() => {
      playBeep(400, 0.2, 'sine');
    }, 150);
  }, [playBeep]);

  // Play error sound (low buzz)
  const playErrorSound = useCallback(() => {
    playBeep(200, 0.5, 'square');
  }, [playBeep]);

  return {
    playSuccessSound,
    playLocationSuccessSound,
    playErrorSound
  };
};
