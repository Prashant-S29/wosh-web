import { secureStorage } from '@/lib/crypto/org';
import { ProjectsMKDFConfig } from '@/types/encryptions';
import { RecoverOrgKeysResponse } from '@/types/api/response';

interface StoreOrgKeysParams {
  organizationId: string;
  userId: string;
  serverKeysData: RecoverOrgKeysResponse;
}

/**
 * Service for managing organization keys and MKDF configuration
 */
export class OrganizationKeysService {
  /**
   * Store organization keys from server response to IndexedDB
   */
  static async storeOrgKeys({
    organizationId,
    userId,
    serverKeysData,
  }: StoreOrgKeysParams): Promise<{ error: boolean; message?: string }> {
    if (!serverKeysData) {
      return { error: true, message: 'No server data provided' };
    }

    try {
      const storeResult = await secureStorage.storeOrgKeysMKDF(organizationId, userId, {
        combinationSalt: serverKeysData.deviceInfo.combinationSalt,
        iv: serverKeysData.encryptionIv,
        publicKey: serverKeysData.publicKey,
        privateKeyEncrypted: serverKeysData.privateKeyEncrypted,
        salt: serverKeysData.keyDerivationSalt,
        ...(serverKeysData.deviceInfo.pinSalt
          ? { pinSalt: serverKeysData.deviceInfo.pinSalt }
          : {}),
        mkdfConfig: {
          enabledFactors: serverKeysData.factorConfig.enabledFactors,
          requiredFactors: serverKeysData.factorConfig.requiredFactors,
        },
        deviceFingerprint: serverKeysData.deviceInfo.deviceFingerprint,
        deviceKeyEncrypted: serverKeysData.deviceInfo.encryptedDeviceKey,
        deviceKeyIv: serverKeysData.deviceInfo.keyDerivationSalt,
        deviceKeySalt: serverKeysData.deviceInfo.keyDerivationSalt,
        mkdfVersion: serverKeysData.mkdfVersion,
      });

      if (storeResult.error) {
        return { error: true, message: 'Failed to store keys in IndexedDB' };
      }

      return { error: false };
    } catch (error) {
      console.error('Error storing organization keys:', error);
      return { error: true, message: 'Unexpected error storing keys' };
    }
  }

  /**
   * Extract MKDF configuration from server response
   */
  static extractMkdfConfig(serverKeysData: RecoverOrgKeysResponse): ProjectsMKDFConfig | null {
    if (!serverKeysData?.factorConfig) {
      return null;
    }

    return {
      requiredFactors: serverKeysData.factorConfig.requiredFactors,
      enabledFactors: serverKeysData.factorConfig.enabledFactors,
      requiresPin: serverKeysData.factorConfig.enabledFactors.includes('pin'),
    };
  }

  /**
   * Get organization keys from IndexedDB or server
   */
  static async getOrgKeys(
    organizationId: string,
    userId: string,
    refetchOrgKeys: () => Promise<{ data?: RecoverOrgKeysResponse }>,
  ): Promise<{
    mkdfConfig: ProjectsMKDFConfig | null;
    error: boolean;
    message?: string;
  }> {
    try {
      // Try IndexedDB first
      const localKeys = await secureStorage.getOrgKeysMKDF(organizationId, userId);

      if (localKeys.data) {
        return {
          mkdfConfig: {
            requiresPin: localKeys.data.mkdfConfig.enabledFactors.includes('pin'),
            requiredFactors: localKeys.data.mkdfConfig.requiredFactors,
            enabledFactors: localKeys.data.mkdfConfig.enabledFactors,
          },
          error: false,
        };
      }

      // Fetch from server if not in IndexedDB
      const { data: serverResponse } = await refetchOrgKeys();

      if (!serverResponse?.factorConfig) {
        return {
          mkdfConfig: null,
          error: true,
          message: 'Failed to load security configuration from server',
        };
      }

      const mkdfConfig = this.extractMkdfConfig(serverResponse);

      // Store for future use
      await this.storeOrgKeys({
        organizationId,
        userId,
        serverKeysData: serverResponse,
      });

      return { mkdfConfig, error: false };
    } catch (error) {
      console.error('Error getting organization keys:', error);
      return {
        mkdfConfig: null,
        error: true,
        message: 'Unexpected error loading security configuration',
      };
    }
  }
}
