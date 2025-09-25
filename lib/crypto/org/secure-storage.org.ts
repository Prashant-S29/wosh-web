import { StoredOrgKeys, StoredOrgKeysMKDF, StoredOrgKeyDataMKDF } from '@/types/encryptions';
import {
  initWoshDB,
  STORES,
  isSecureStorageAvailable,
  type StoreResult,
} from '../../indexdb/config.indexdb';

// Legacy interface for backward compatibility
interface StoredOrgKeyData extends StoredOrgKeys {
  organizationId: string;
  userId: string;
  createdAt: number;
  lastAccessed: number;
}

// Store MKDF organization keys securely in IndexedDB
export async function storeOrgKeysMKDF(
  organizationId: string,
  userId: string,
  keys: StoredOrgKeysMKDF,
): Promise<StoreResult<null>> {
  try {
    // Validate inputs
    if (!organizationId || !userId) {
      return {
        data: null,
        error: new Error('Missing parameters'),
        message: 'Organization ID and User ID are required',
      };
    }

    // Validate MKDF keys
    if (
      !keys.publicKey ||
      !keys.privateKeyEncrypted ||
      !keys.salt ||
      !keys.iv ||
      !keys.deviceFingerprint ||
      !keys.deviceKeyEncrypted ||
      !keys.deviceKeySalt
    ) {
      return {
        data: null,
        error: new Error('Incomplete MKDF keys'),
        message: 'All MKDF key components are required',
      };
    }

    // Initialize database
    let db: IDBDatabase;
    try {
      db = await initWoshDB();
    } catch (dbError) {
      return {
        data: null,
        error: dbError,
        message: 'Failed to initialize database',
      };
    }

    const keyData: StoredOrgKeyDataMKDF = {
      organizationId,
      userId,
      mkdfVersion: keys.mkdfVersion,
      mkdfConfig: keys.mkdfConfig,
      publicKey: keys.publicKey,
      privateKeyEncrypted: keys.privateKeyEncrypted,
      salt: keys.salt,
      iv: keys.iv,
      deviceFingerprint: keys.deviceFingerprint,
      deviceKeyEncrypted: keys.deviceKeyEncrypted!,
      deviceKeyIv: keys.deviceKeyIv!,
      deviceKeySalt: keys.deviceKeySalt!,
      combinationSalt: keys.combinationSalt,
      ...(keys.pinSalt ? { pinSalt: keys.pinSalt } : {}),
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.ORG_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ORG_KEYS);
        const request = store.put(keyData);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to store MKDF organization keys in IndexedDB',
          });
        };

        request.onsuccess = () => {
          resolve({
            data: null,
            error: null,
            message: 'MKDF organization keys stored successfully',
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while storing MKDF keys',
          });
        };

        transaction.onabort = () => {
          resolve({
            data: null,
            error: new Error('Transaction aborted'),
            message: 'MKDF storage transaction was aborted',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during MKDF key storage operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for saving MKDF keys',
    };
  }
}

// Retrieve MKDF organization keys from secure storage
export async function getOrgKeysMKDF(
  organizationId: string,
  userId: string,
): Promise<StoreResult<StoredOrgKeysMKDF>> {
  try {
    // Validate inputs
    if (!organizationId || !userId) {
      return {
        data: null,
        error: new Error('Missing parameters'),
        message: 'Organization ID and User ID are required',
      };
    }

    // Initialize database
    let db: IDBDatabase;
    try {
      db = await initWoshDB();
    } catch (dbError) {
      return {
        data: null,
        error: dbError,
        message: 'Failed to initialize database',
      };
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.ORG_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ORG_KEYS);
        const request = store.get(organizationId);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to retrieve MKDF organization keys from IndexedDB',
          });
        };

        request.onsuccess = () => {
          const result = request.result as StoredOrgKeyDataMKDF | StoredOrgKeyData | undefined;

          if (!result) {
            resolve({
              data: null,
              error: null,
              message: 'Organization keys not found in local storage',
            });
            return;
          }

          // Verify user ownership
          if (result.userId !== userId) {
            resolve({
              data: null,
              error: new Error('Access denied'),
              message: 'Access denied: You do not have permission to access these keys',
            });
            return;
          }

          try {
            // Update last accessed time
            result.lastAccessed = Date.now();
            const updateRequest = store.put(result);

            updateRequest.onerror = () => {
              // Don't fail the whole operation if we can't update timestamp
              console.warn('Failed to update last accessed time');
            };

            // Check if this is MKDF data or legacy data
            const isMKDFData = 'mkdfVersion' in result && 'deviceFingerprint' in result;

            if (!isMKDFData) {
              resolve({
                data: null,
                error: new Error('Legacy keys found'),
                message: 'Legacy organization keys found. MKDF upgrade required.',
              });
              return;
            }

            const mkdfResult = result as StoredOrgKeyDataMKDF;

            const keys: StoredOrgKeysMKDF = {
              publicKey: mkdfResult.publicKey,
              privateKeyEncrypted: mkdfResult.privateKeyEncrypted,
              salt: mkdfResult.salt,
              iv: mkdfResult.iv,
              mkdfVersion: mkdfResult.mkdfVersion,
              mkdfConfig: mkdfResult.mkdfConfig,
              deviceFingerprint: mkdfResult.deviceFingerprint,
              deviceKeyEncrypted: mkdfResult.deviceKeyEncrypted,
              deviceKeyIv: mkdfResult.deviceKeyIv,
              deviceKeySalt: mkdfResult.deviceKeySalt,
              combinationSalt: mkdfResult.combinationSalt,
              ...(mkdfResult.pinSalt ? { pinSalt: mkdfResult.pinSalt } : {}),
            };

            resolve({
              data: keys,
              error: null,
              message: 'MKDF organization keys retrieved successfully',
            });
          } catch (error) {
            resolve({
              data: null,
              error,
              message: 'Error processing retrieved MKDF keys',
            });
          }
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while retrieving MKDF keys',
          });
        };

        transaction.onabort = () => {
          resolve({
            data: null,
            error: new Error('Transaction aborted'),
            message: 'MKDF retrieval transaction was aborted',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during MKDF key retrieval operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for retrieving MKDF keys',
    };
  }
}

// Check if organization has MKDF keys
export async function hasOrgKeysMKDF(
  organizationId: string,
  userId: string,
): Promise<StoreResult<{ hasMKDF: boolean; hasLegacy: boolean }>> {
  try {
    const result = await getOrgKeysMKDF(organizationId, userId);

    if (result.error) {
      if (result.message === 'Organization keys not found in local storage') {
        return {
          data: { hasMKDF: false, hasLegacy: false },
          error: null,
          message: 'No keys found',
        };
      }

      if (result.message === 'Legacy organization keys found. MKDF upgrade required.') {
        return {
          data: { hasMKDF: false, hasLegacy: true },
          error: null,
          message: 'Legacy keys found, MKDF upgrade available',
        };
      }

      return {
        data: null,
        error: result.error,
        message: result.message,
      };
    }

    return {
      data: { hasMKDF: result.data !== null, hasLegacy: false },
      error: null,
      message: result.data ? 'MKDF keys exist' : 'No MKDF keys found',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Error checking if MKDF organization keys exist',
    };
  }
}

// Verify device fingerprint matches stored value
export async function verifyDeviceFingerprint(
  organizationId: string,
  userId: string,
  currentFingerprint: string,
): Promise<StoreResult<{ matches: boolean; storedFingerprint?: string | undefined }>> {
  try {
    const keys = await getOrgKeysMKDF(organizationId, userId);
    if (!keys.data) {
      return {
        data: null,
        error: keys.error,
        message: keys.message,
      };
    }

    const matches = keys.data.deviceFingerprint === currentFingerprint;

    return {
      data: {
        matches,
        storedFingerprint: keys.data.deviceFingerprint,
      },
      error: null,
      message: matches ? 'Device fingerprint verified' : 'Device fingerprint mismatch',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to verify device fingerprint',
    };
  }
}

// Legacy functions for backward compatibility
export async function storeOrgKeys(
  organizationId: string,
  userId: string,
  keys: StoredOrgKeys,
): Promise<StoreResult<null>> {
  try {
    // Validate inputs
    if (!organizationId || !userId) {
      return {
        data: null,
        error: new Error('Missing parameters'),
        message: 'Organization ID and User ID are required',
      };
    }

    if (!keys.publicKey || !keys.privateKeyEncrypted || !keys.salt || !keys.iv) {
      return {
        data: null,
        error: new Error('Incomplete keys'),
        message: 'All key components are required',
      };
    }

    // Initialize database
    let db: IDBDatabase;
    try {
      db = await initWoshDB();
    } catch (dbError) {
      return {
        data: null,
        error: dbError,
        message: 'Failed to initialize database',
      };
    }

    const keyData: StoredOrgKeyData = {
      ...keys,
      userId,
      organizationId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.ORG_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ORG_KEYS);
        const request = store.put(keyData);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to store organization keys in IndexedDB',
          });
        };

        request.onsuccess = () => {
          resolve({
            data: null,
            error: null,
            message: 'Organization keys stored successfully',
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while storing keys',
          });
        };

        transaction.onabort = () => {
          resolve({
            data: null,
            error: new Error('Transaction aborted'),
            message: 'Storage transaction was aborted',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during key storage operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for saving keys',
    };
  }
}

// Retrieve organization keys from secure storage (legacy)
export async function getOrgKeys(
  organizationId: string,
  userId: string,
): Promise<StoreResult<StoredOrgKeys>> {
  try {
    // Validate inputs
    if (!organizationId || !userId) {
      return {
        data: null,
        error: new Error('Missing parameters'),
        message: 'Organization ID and User ID are required',
      };
    }

    // Initialize database
    let db: IDBDatabase;
    try {
      db = await initWoshDB();
    } catch (dbError) {
      return {
        data: null,
        error: dbError,
        message: 'Failed to initialize database',
      };
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.ORG_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ORG_KEYS);
        const request = store.get(organizationId);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to retrieve organization keys from IndexedDB',
          });
        };

        request.onsuccess = () => {
          const result = request.result as StoredOrgKeyData | StoredOrgKeyDataMKDF | undefined;

          if (!result) {
            resolve({
              data: null,
              error: null,
              message: 'Organization keys not found in local storage',
            });
            return;
          }

          // Verify user ownership
          if (result.userId !== userId) {
            resolve({
              data: null,
              error: new Error('Access denied'),
              message: 'Access denied: You do not have permission to access these keys',
            });
            return;
          }

          try {
            // Update last accessed time
            result.lastAccessed = Date.now();
            const updateRequest = store.put(result);

            updateRequest.onerror = () => {
              // Don't fail the whole operation if we can't update timestamp
              console.warn('Failed to update last accessed time');
            };

            const keys: StoredOrgKeys = {
              publicKey: result.publicKey,
              privateKeyEncrypted: result.privateKeyEncrypted,
              salt: result.salt,
              iv: result.iv,
            };

            resolve({
              data: keys,
              error: null,
              message: 'Organization keys retrieved successfully',
            });
          } catch (error) {
            resolve({
              data: null,
              error,
              message: 'Error processing retrieved keys',
            });
          }
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while retrieving keys',
          });
        };

        transaction.onabort = () => {
          resolve({
            data: null,
            error: new Error('Transaction aborted'),
            message: 'Retrieval transaction was aborted',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during key retrieval operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for retrieving keys',
    };
  }
}

// Check if organization keys exist (legacy)
export async function hasOrgKeys(
  organizationId: string,
  userId: string,
): Promise<StoreResult<boolean>> {
  try {
    const result = await getOrgKeys(organizationId, userId);

    if (result.error && result.message !== 'Organization keys not found in local storage') {
      return {
        data: null,
        error: result.error,
        message: result.message,
      };
    }

    return {
      data: result.data !== null,
      error: null,
      message: result.data ? 'Keys exist' : 'Keys do not exist',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Error checking if organization keys exist',
    };
  }
}

// Delete organization keys (for logout or key rotation)
export async function deleteOrgKeys(
  organizationId: string,
  userId: string,
): Promise<StoreResult<null>> {
  try {
    // Validate inputs
    if (!organizationId || !userId) {
      return {
        data: null,
        error: new Error('Missing parameters'),
        message: 'Organization ID and User ID are required',
      };
    }

    // First verify ownership
    const existingKeys = await getOrgKeys(organizationId, userId);
    if (!existingKeys.data && existingKeys.error) {
      return {
        data: null,
        error: existingKeys.error,
        message: existingKeys.message,
      };
    }

    if (!existingKeys.data) {
      return {
        data: null,
        error: null,
        message: 'No keys found to delete',
      };
    }

    const db = await initWoshDB();

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.ORG_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ORG_KEYS);
        const request = store.delete(organizationId);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to delete organization keys',
          });
        };

        request.onsuccess = () => {
          resolve({
            data: null,
            error: null,
            message: 'Organization keys deleted successfully',
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while deleting keys',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during key deletion operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for deleting keys',
    };
  }
}

// Clear all stored keys (for logout/reset)
export async function clearAllKeys(userId: string): Promise<StoreResult<null>> {
  try {
    if (!userId) {
      return {
        data: null,
        error: new Error('Missing user ID'),
        message: 'User ID is required for clearing keys',
      };
    }

    const db = await initWoshDB();

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.ORG_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ORG_KEYS);
        const index = store.index('userId');
        const request = index.openCursor(userId);

        let deletedCount = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            resolve({
              data: null,
              error: null,
              message: `Successfully cleared ${deletedCount} organization keys`,
            });
          }
        };

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to clear organization keys',
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while clearing keys',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during key clearing operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for clearing keys',
    };
  }
}

// Enhanced secure storage interface object
export const secureStorage = {
  // MKDF functions
  storeOrgKeysMKDF,
  getOrgKeysMKDF,
  hasOrgKeysMKDF,
  verifyDeviceFingerprint,
  isAvailable: isSecureStorageAvailable,
};
