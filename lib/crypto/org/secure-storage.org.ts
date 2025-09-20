import { StoredOrgKeys } from '@/types/encryptions';
import {
  initWoshDB,
  STORES,
  isSecureStorageAvailable,
  type StoreResult,
} from '../../indexdb/config.indexdb';

interface StoredOrgKeyData extends StoredOrgKeys {
  organizationId: string;
  userId: string;
  createdAt: number;
  lastAccessed: number;
}

// Store organization keys securely in IndexedDB
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

// Retrieve organization keys from secure storage
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
          const result = request.result as StoredOrgKeyData | undefined;

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

// Check if organization keys exist
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

// Secure storage interface object
export const secureStorage = {
  storeOrgKeys,
  getOrgKeys,
  hasOrgKeys,
  deleteOrgKeys,
  clearAllKeys,
  isAvailable: isSecureStorageAvailable,
};
