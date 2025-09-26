import { useCallback } from 'react';

export const useCopyToClipboard = () => {
  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) {
      return { success: false, isLoading: false };
    }

    try {
      await navigator.clipboard.writeText(text);
      return { success: true, isLoading: false };
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);

      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        return { success: true, isLoading: false };
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        return { success: false, isLoading: false };
      }
    }
  }, []);

  return {
    copyToClipboard,
  };
};
