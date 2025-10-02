import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { secureStorage } from '@/lib/crypto/org';
import { generateDeviceFingerprint } from '@/lib/crypto/org/device-fingerprint';
import { useTypedQuery } from '@/hooks';
import { RecoverOrgKeysResponse } from '@/types/api/response';
import { ProjectsMKDFConfig } from '@/types/encryptions';

interface UseMKDFConfigParams {
  organizationId: string;
  userId: string;
  enabled?: boolean;
}

interface UseMKDFConfigReturn {
  mkdfConfig: ProjectsMKDFConfig | null;
  isLoadingConfig: boolean;
  deviceVerified: boolean;
  deviceFingerprint: string;
  refetchConfig: () => Promise<void>;
}

export const useMKDFConfig = ({
  organizationId,
  userId,
  enabled = true,
}: UseMKDFConfigParams): UseMKDFConfigReturn => {
  const [mkdfConfig, setMkdfConfig] = useState<ProjectsMKDFConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [deviceVerified, setDeviceVerified] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');

  const { refetch: refetchOrgKeys } = useTypedQuery<RecoverOrgKeysResponse>({
    endpoint: `/api/organization/keys?orgId=${organizationId}`,
    queryKey: ['organization-keys', organizationId, userId],
    enabled: false,
  });

  const loadMkdfConfig = async () => {
    try {
      setIsLoadingConfig(true);

      if (!userId || !enabled) {
        return;
      }

      // Generate device fingerprint
      const fingerprintResult = await generateDeviceFingerprint();
      if (fingerprintResult.fingerprint) {
        setDeviceFingerprint(fingerprintResult.fingerprint);
        setDeviceVerified(fingerprintResult.confidence !== 'low');

        if (fingerprintResult.confidence === 'low') {
          toast.warning('Device fingerprinting has low reliability on this device');
        }
      }

      // Try to load from IndexedDB first
      const orgKeysResult = await secureStorage.getOrgKeysMKDF(organizationId, userId);

      if (!orgKeysResult.data) {
        // Fetch from server if not found locally
        const { data: serverKeysData } = await refetchOrgKeys();

        if (!serverKeysData?.data?.factorConfig) {
          toast.error('Failed to load security configuration from server');
          return;
        }

        const mkdfConfigData: ProjectsMKDFConfig = {
          requiredFactors: serverKeysData.data.factorConfig.requiredFactors,
          enabledFactors: serverKeysData.data.factorConfig.enabledFactors,
          requiresPin: serverKeysData.data.factorConfig.enabledFactors.includes('pin'),
        };

        setMkdfConfig(mkdfConfigData);

        // Store keys in IndexedDB for future use
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
            enabledFactors: mkdfConfigData.enabledFactors,
            requiredFactors: mkdfConfigData.requiredFactors,
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
        }
        return;
      }

      // Use local MKDF keys
      setMkdfConfig({
        requiresPin: orgKeysResult.data.mkdfConfig.enabledFactors.includes('pin'),
        requiredFactors: orgKeysResult.data.mkdfConfig.requiredFactors,
        enabledFactors: orgKeysResult.data.mkdfConfig.enabledFactors,
      });
    } catch (error) {
      console.error('Error loading MKDF configuration:', error);
      toast.error('Failed to load security configuration');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (userId && enabled) {
      loadMkdfConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, enabled]);

  return {
    mkdfConfig,
    isLoadingConfig,
    deviceVerified,
    deviceFingerprint,
    refetchConfig: loadMkdfConfig,
  };
};
