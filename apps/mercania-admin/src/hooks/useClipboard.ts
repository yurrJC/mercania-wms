import { useState, useCallback } from 'react';

export type ClipboardSource = 'barcode' | 'id';

export const useClipboard = () => {
  const [copySuccess, setCopySuccess] = useState<ClipboardSource | null>(null);

  const copyToClipboard = useCallback(async (text: string, source: ClipboardSource) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(source);
      
      // Clear success indicator after 2 seconds
      setTimeout(() => setCopySuccess(null), 2000);
      
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);

  return {
    copySuccess,
    copyToClipboard
  };
};
