import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { generateDeviceFingerprint } from '@/lib/crypto/org/device-fingerprint';
import { secureStorage } from '@/lib/crypto/org/secure-storage.org';
import { retrieveOrgPrivateKeyMKDF, secureWipe } from '@/lib/crypto/org/crypto-utils.org';
import { projectSecureStorage } from '@/lib/crypto/project/secure-storage.project';
import {
  unwrapProjectKey,
  deriveProjectStorageKey,
  WrappedProjectKey,
} from '@/lib/crypto/project/crypto-utils.project';
import { ApiResult } from '@/types/api';
import { useTypedQuery } from './api';
import { GetProjectKeysResponse, RecoverOrgKeysResponse } from '@/types/api/response';
import { StoredOrgKeysMKDF } from '@/types/encryptions';
import { StoreResult } from '@/lib/indexdb/config.indexdb';

export interface ProjectKeyCredentials {
  masterPassphrase: string;
  pin?: string | undefined;
}

export interface UseProjectKeyReturn {
  isRecovering: boolean;
  recoverProjectKey: (credentials: ProjectKeyCredentials) => Promise<ApiResult<Uint8Array>>;
  clearProjectKey: () => void;
}

export function useProjectKey(
  projectId: string,
  organizationId: string,
  userId?: string,
): UseProjectKeyReturn {
  const [isRecovering, setIsRecovering] = useState(false);
  const [cachedProjectKey, setCachedProjectKey] = useState<Uint8Array | null>(null);

  const { refetch: refetchOrgKeys } = useTypedQuery<RecoverOrgKeysResponse>({
    endpoint: `/api/organization/keys?orgId=${organizationId}`,
    queryKey: ['organization-keys', organizationId, userId],
    enabled: false,
  });

  const { refetch: refetchProjectKeys } = useTypedQuery<GetProjectKeysResponse>({
    endpoint: `/api/project/keys?orgId=${organizationId}&projectId=${projectId}`,
    queryKey: ['project-keys', projectId, userId],
    enabled: false,
  });

  const recoverProjectKey = async (
    credentials: ProjectKeyCredentials,
  ): Promise<ApiResult<Uint8Array>> => {
    let orgPrivateKey: Uint8Array | null = null;
    let storageKey: Uint8Array | null = null;

    try {
      setIsRecovering(true);

      if (!userId) {
        return {
          data: null,
          error: 'User ID required',
          message: 'User must be authenticated to recover project key',
        };
      }

      // Generate device fingerprint
      const fingerprintResult = await generateDeviceFingerprint();
      console.log('fingerprintResult', fingerprintResult);
      if (!fingerprintResult.fingerprint) {
        return {
          data: null,
          error: 'Device fingerprint generation failed',
          message: 'Failed to generate device fingerprint',
        };
      }

      let orgKeys: StoreResult<StoredOrgKeysMKDF> | null = null;

      // Get organization keys from local storage
      orgKeys = await secureStorage.getOrgKeysMKDF(organizationId, userId);
      console.log('orgKeys', orgKeys);

      // if organization keys not found locally, get from server
      if (!orgKeys.data) {
        const { data: serverKeysData } = await refetchOrgKeys();
        console.log('serverKeysData', serverKeysData);

        // if keys not found on server
        if (!serverKeysData?.data?.factorConfig) {
          return {
            data: null,
            error: 'Failed to load security configuration from server',
            message: 'Failed to load security configuration from server',
          };
        }

        orgKeys.data = {
          combinationSalt: serverKeysData.data.deviceInfo.combinationSalt,
          iv: serverKeysData.data.encryptionIv,
          publicKey: serverKeysData.data.publicKey,
          privateKeyEncrypted: serverKeysData.data.privateKeyEncrypted,
          salt: serverKeysData.data.keyDerivationSalt,
          ...(serverKeysData.data.deviceInfo.pinSalt
            ? { pinSalt: serverKeysData.data.deviceInfo.pinSalt }
            : {}),
          mkdfConfig: {
            enabledFactors: serverKeysData.data.factorConfig.enabledFactors,
            requiredFactors: serverKeysData.data.factorConfig.requiredFactors,
          },
          deviceFingerprint: serverKeysData.data.deviceInfo.deviceFingerprint,
          deviceKeyEncrypted: serverKeysData.data.deviceInfo.encryptedDeviceKey,
          deviceKeyIv: serverKeysData.data.deviceInfo.keyDerivationSalt,
          deviceKeySalt: serverKeysData.data.deviceInfo.keyDerivationSalt,
          mkdfVersion: serverKeysData.data.mkdfVersion,
        };

        // store the keys back to indexdb
        const storeOrgKeysResponse = await secureStorage.storeOrgKeysMKDF(organizationId, userId, {
          combinationSalt: serverKeysData.data.deviceInfo.combinationSalt,
          iv: serverKeysData.data.encryptionIv,
          publicKey: serverKeysData.data.publicKey,
          privateKeyEncrypted: serverKeysData.data.privateKeyEncrypted,
          salt: serverKeysData.data.keyDerivationSalt,
          ...(serverKeysData.data.deviceInfo.pinSalt
            ? { pinSalt: serverKeysData.data.deviceInfo.pinSalt }
            : {}),
          mkdfConfig: {
            enabledFactors: serverKeysData.data.factorConfig.enabledFactors,
            requiredFactors: serverKeysData.data.factorConfig.requiredFactors,
          },
          deviceFingerprint: serverKeysData.data.deviceInfo.deviceFingerprint,
          deviceKeyEncrypted: serverKeysData.data.deviceInfo.encryptedDeviceKey,
          deviceKeyIv: serverKeysData.data.deviceInfo.keyDerivationSalt,
          deviceKeySalt: serverKeysData.data.deviceInfo.keyDerivationSalt,
          mkdfVersion: serverKeysData.data.mkdfVersion,
        });

        if (storeOrgKeysResponse.error) {
          console.warn('Failed to store MKDF keys locally:', storeOrgKeysResponse.error);
          toast.warning('Keys retrieved from server but could not be cached locally');
        } else {
          console.log('Successfully cached MKDF keys locally');
        }
      }

      // Verify device fingerprint
      if (orgKeys.data.deviceFingerprint !== fingerprintResult.fingerprint) {
        return {
          data: null,
          error: 'Device verification failed',
          message: 'This device is not registered for this organization',
        };
      }

      // Recover organization private key using MKDF
      const privateKeyResult = await retrieveOrgPrivateKeyMKDF(
        credentials.masterPassphrase,
        fingerprintResult.fingerprint,
        credentials.pin,
        orgKeys.data,
      );

      if (privateKeyResult.error || !privateKeyResult.data) {
        return {
          data: null,
          error: privateKeyResult.error,
          message: privateKeyResult.message,
        };
      }

      orgPrivateKey = privateKeyResult.data;

      // Derive storage key for this project
      const storageKeyResult = await deriveProjectStorageKey(orgPrivateKey, projectId);
      if (storageKeyResult.error || !storageKeyResult.data) {
        return {
          data: null,
          error: storageKeyResult.error,
          message: storageKeyResult.message,
        };
      }

      storageKey = storageKeyResult.data;

      console.log('storageKey', storageKey);

      let wrappedProjectKeyResult: {
        data: WrappedProjectKey | null;
        error: string | null;
        message: string;
      } | null = null;

      let projectKey: Uint8Array | null = null;
      let shouldStoreLocally = false;

      // Try to get wrapped project key from local storage
      wrappedProjectKeyResult = await projectSecureStorage.getWrappedProjectKey(projectId);

      // if project key not found locally, get from the server
      if (!wrappedProjectKeyResult.data) {
        const { data: serverProjectKeysData } = await refetchProjectKeys();
        console.log('serverProjectKeysData', serverProjectKeysData);

        if (!serverProjectKeysData?.data?.wrappedSymmetricKey) {
          return {
            data: null,
            error: 'Failed to load project key from server',
            message: 'Failed to load project key from server',
          };
        }

        wrappedProjectKeyResult.data = JSON.parse(serverProjectKeysData.data.wrappedSymmetricKey);

        if (!wrappedProjectKeyResult.data) {
          return {
            data: null,
            error: 'Failed to parse project key from server',
            message: 'Failed to parse project key from server',
          };
        }

        shouldStoreLocally = true;
      }

      // Unwrap project key using organization private key (ALWAYS do this)
      const unwrapResult = await unwrapProjectKey(wrappedProjectKeyResult.data, orgPrivateKey);

      console.log('unwrapResult', unwrapResult);

      if (unwrapResult.error || !unwrapResult.data) {
        return {
          data: null,
          error: unwrapResult.error,
          message: unwrapResult.message,
        };
      }

      projectKey = unwrapResult.data;

      console.log('projectKey', projectKey);

      // Store the key locally for future use (only if it wasn't already stored)
      if (shouldStoreLocally) {
        const storeResult = await projectSecureStorage.storeProjectKey(
          projectId,
          organizationId,
          projectKey,
          wrappedProjectKeyResult.data,
          storageKey,
        );

        if (storeResult.error) {
          console.warn('Failed to cache project key locally:', storeResult.error);
          // Continue anyway - key recovery succeeded
        } else {
          console.log('Successfully cached project key locally');
        }
      }

      setCachedProjectKey(projectKey);

      return {
        data: projectKey,
        error: null,
        message: 'Project key recovered and cached successfully',
      };
    } catch (error) {
      console.error('Project key recovery failed:', error);
      return {
        data: null,
        error: 'Failed to recover project key',
        message: 'Failed to recover project key',
      };
    } finally {
      // Secure cleanup
      if (orgPrivateKey) {
        secureWipe(orgPrivateKey);
      }
      if (storageKey) {
        secureWipe(storageKey);
      }
      setIsRecovering(false);
    }
  };

  const clearProjectKey = useCallback(() => {
    if (cachedProjectKey) {
      secureWipe(cachedProjectKey);
      setCachedProjectKey(null);
    }
  }, [cachedProjectKey]);

  return {
    isRecovering,
    recoverProjectKey,
    clearProjectKey,
  };
}
