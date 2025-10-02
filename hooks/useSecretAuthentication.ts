import { useState, useCallback } from 'react';
import { ProjectKeyCredentials, useProjectKey } from '@/hooks/useProjectKey';

interface UseSecretAuthenticationParams {
  projectId: string;
  organizationId: string;
  userId: string;
}

interface UseSecretAuthenticationReturn<T> {
  showAuthModal: boolean;
  isAuthenticating: boolean;
  pendingData: T | null;
  openAuthModal: (data: T) => void;
  closeAuthModal: () => void;
  handleAuthentication: (
    credentials: ProjectKeyCredentials,
    onSuccess: (projectKey: Uint8Array, data: T) => Promise<void>,
  ) => Promise<void>;
}

export const useSecretAuthentication = <T = unknown>({
  projectId,
  organizationId,
  userId,
}: UseSecretAuthenticationParams): UseSecretAuthenticationReturn<T> => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingData, setPendingData] = useState<T | null>(null);

  const { isRecovering, recoverProjectKey, clearProjectKey } = useProjectKey(
    projectId,
    organizationId,
    userId,
  );

  const openAuthModal = useCallback((data: T) => {
    setPendingData(data);
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setPendingData(null);
  }, []);

  const handleAuthentication = useCallback(
    async (
      credentials: ProjectKeyCredentials,
      onSuccess: (projectKey: Uint8Array, data: T) => Promise<void>,
    ) => {
      let projectKey: Uint8Array | null = null;

      try {
        if (!pendingData) {
          throw new Error('No data to process');
        }

        // Recover project key
        const keyResult = await recoverProjectKey(credentials);

        if (keyResult.error || !keyResult.data) {
          throw new Error(keyResult.message);
        }

        projectKey = keyResult.data;

        // Execute the success callback with the recovered key
        await onSuccess(projectKey, pendingData);

        // Close modal on success
        closeAuthModal();
      } finally {
        // Clear credentials from memory
        if (credentials.masterPassphrase) {
          credentials.masterPassphrase = '';
        }
        if (credentials.pin) {
          credentials.pin = '';
        }

        // Clear project key from memory
        clearProjectKey();
      }
    },
    [pendingData, recoverProjectKey, clearProjectKey, closeAuthModal],
  );

  return {
    showAuthModal,
    isAuthenticating: isRecovering,
    pendingData,
    openAuthModal,
    closeAuthModal,
    handleAuthentication,
  };
};
