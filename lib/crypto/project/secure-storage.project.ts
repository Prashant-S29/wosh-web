import { WrappedProjectKey } from './crypto-utils.project';
import { toBase64, fromBase64 } from '../org/crypto-utils.org';
import {
  initWoshDB,
  STORES,
  isSecureStorageAvailable,
  type StoreResult,
} from '../../indexdb/config.indexdb';

type ProjectStorageResult<T> = StoreResult<T>;

interface StoredProjectKeyData {
  projectId: string;
  encryptedKey: string; // Base64 encrypted project key
  iv: string; // Base64 IV
  wrappedKey: WrappedProjectKey; // For server communication
  organizationId: string;
  createdAt: number;
  lastAccessedAt: number;
}

function toBufferSource(input: Uint8Array | ArrayBuffer): BufferSource {
  return input instanceof Uint8Array ? new Uint8Array(input) : input;
}

// Store project key securely in IndexedDB
export async function storeProjectKey(
  projectId: string,
  organizationId: string,
  projectKey: Uint8Array,
  wrappedKey: WrappedProjectKey,
  storageKey: Uint8Array,
): Promise<ProjectStorageResult<null>> {
  try {
    // Validate inputs
    if (!projectId || !organizationId) {
      return {
        data: null,
        error: new Error('Missing required parameters'),
        message: 'Project ID and Organization ID are required',
      };
    }

    if (!projectKey || projectKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid project key'),
        message: 'Project key must be 32 bytes',
      };
    }

    if (!storageKey || storageKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid storage key'),
        message: 'Storage key must be 32 bytes',
      };
    }

    if (!wrappedKey || !wrappedKey.ciphertext || !wrappedKey.iv) {
      return {
        data: null,
        error: new Error('Invalid wrapped key'),
        message: 'Wrapped key is incomplete or invalid',
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

    // Encrypt project key for storage using Web Crypto API
    let encrypted: ArrayBuffer;
    const iv = crypto.getRandomValues(new Uint8Array(12));

    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toBufferSource(storageKey),
        { name: 'AES-GCM' },
        false,
        ['encrypt'],
      );

      encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        toBufferSource(projectKey),
      );
    } catch (cryptoError) {
      return {
        data: null,
        error: cryptoError,
        message: 'Failed to encrypt project key for storage',
      };
    }

    // Convert to base64 for storage
    const encryptedB64Result = toBase64(new Uint8Array(encrypted));
    const ivB64Result = toBase64(iv);

    if (!encryptedB64Result.data || !ivB64Result.data) {
      return {
        data: null,
        error: encryptedB64Result.error || ivB64Result.error,
        message: 'Failed to encode encrypted project key for storage',
      };
    }

    const keyData: StoredProjectKeyData = {
      projectId,
      organizationId,
      encryptedKey: encryptedB64Result.data,
      iv: ivB64Result.data,
      wrappedKey,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);
        const request = store.put(keyData);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to store project key in IndexedDB',
          });
        };
        request.onsuccess = () => {
          resolve({
            data: null,
            error: null,
            message: 'Project key stored successfully',
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while storing project key',
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
          message: 'Error during project key storage operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for project key',
    };
  }
}

// Retrieve project key from secure storage
export async function getProjectKey(
  projectId: string,
  storageKey: Uint8Array,
): Promise<ProjectStorageResult<Uint8Array>> {
  try {
    // Validate inputs
    if (!projectId) {
      return {
        data: null,
        error: new Error('Missing project ID'),
        message: 'Project ID is required',
      };
    }

    if (!storageKey || storageKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid storage key'),
        message: 'Storage key must be 32 bytes',
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

    const keyData = await new Promise<StoredProjectKeyData | null>((resolve, reject) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);
        const request = store.get(projectId);

        request.onerror = () => {
          reject({
            error: request.error,
            message: 'Failed to retrieve project key from IndexedDB',
          });
        };

        request.onsuccess = () => {
          const result = request.result as StoredProjectKeyData | undefined;
          if (result) {
            try {
              // Update last accessed time
              result.lastAccessedAt = Date.now();
              const updateRequest = store.put(result);

              updateRequest.onerror = () => {
                console.warn('Failed to update last accessed time');
              };

              resolve(result);
            } catch (error) {
              reject({
                error,
                message: 'Error updating project key access time',
              });
            }
          } else {
            resolve(null);
          }
        };

        transaction.onerror = () => {
          reject({
            error: transaction.error,
            message: 'Transaction failed while retrieving project key',
          });
        };
      } catch (error) {
        reject({
          error,
          message: 'Error during project key retrieval operation',
        });
      }
    });

    if (!keyData) {
      return {
        data: null,
        error: null,
        message: 'Project key not found in local storage',
      };
    }

    // Decode base64 components
    const encryptedResult = fromBase64(keyData.encryptedKey);
    const ivResult = fromBase64(keyData.iv);

    if (!encryptedResult.data || !ivResult.data) {
      return {
        data: null,
        error: encryptedResult.error || ivResult.error,
        message: 'Failed to decode stored project key data',
      };
    }

    // Decrypt project key using Web Crypto API
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toBufferSource(storageKey),
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toBufferSource(ivResult.data) },
        cryptoKey,
        toBufferSource(encryptedResult.data),
      );

      return {
        data: new Uint8Array(decrypted),
        error: null,
        message: 'Project key retrieved and decrypted successfully',
      };
    } catch (cryptoError) {
      return {
        data: null,
        error: cryptoError,
        message: 'Failed to decrypt project key from storage',
      };
    }
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for project key retrieval',
    };
  }
}

// Get wrapped key for server communication
export async function getWrappedProjectKey(
  projectId: string,
): Promise<ProjectStorageResult<WrappedProjectKey>> {
  try {
    if (!projectId) {
      return {
        data: null,
        error: new Error('Missing project ID'),
        message: 'Project ID is required',
      };
    }

    const db = await initWoshDB();

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readonly');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);
        const request = store.get(projectId);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to retrieve wrapped project key from IndexedDB',
          });
        };

        request.onsuccess = () => {
          const result = request.result as StoredProjectKeyData | undefined;
          if (result) {
            resolve({
              data: result.wrappedKey,
              error: null,
              message: 'Wrapped project key retrieved successfully',
            });
          } else {
            resolve({
              data: null,
              error: null,
              message: 'Wrapped project key not found',
            });
          }
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while retrieving wrapped key',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during wrapped key retrieval operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for wrapped key retrieval',
    };
  }
}

// Check if project key exists
export async function hasProjectKey(projectId: string): Promise<ProjectStorageResult<boolean>> {
  try {
    if (!projectId) {
      return {
        data: false,
        error: new Error('Missing project ID'),
        message: 'Project ID is required',
      };
    }

    const db = await initWoshDB();

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readonly');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);
        const request = store.count(projectId);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to check project key existence',
          });
        };

        request.onsuccess = () => {
          const exists = request.result > 0;
          resolve({
            data: exists,
            error: null,
            message: exists ? 'Project key exists' : 'Project key does not exist',
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while checking key existence',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during key existence check',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for key existence check',
    };
  }
}

// List projects for an organization
export async function listProjectsForOrg(
  organizationId: string,
): Promise<ProjectStorageResult<string[]>> {
  try {
    if (!organizationId) {
      return {
        data: null,
        error: new Error('Missing organization ID'),
        message: 'Organization ID is required',
      };
    }

    const db = await initWoshDB();

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readonly');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);
        const index = store.index('organizationId');
        const request = index.getAllKeys(organizationId);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to list projects for organization',
          });
        };

        request.onsuccess = () => {
          resolve({
            data: request.result as string[],
            error: null,
            message: `Found ${request.result.length} projects for organization`,
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while listing projects',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during project listing operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for project listing',
    };
  }
}

// Delete project key
export async function deleteProjectKey(projectId: string): Promise<ProjectStorageResult<null>> {
  try {
    if (!projectId) {
      return {
        data: null,
        error: new Error('Missing project ID'),
        message: 'Project ID is required',
      };
    }

    const db = await initWoshDB();

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);
        const request = store.delete(projectId);

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to delete project key from IndexedDB',
          });
        };

        request.onsuccess = () => {
          resolve({
            data: null,
            error: null,
            message: 'Project key deleted successfully',
          });
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while deleting project key',
          });
        };

        transaction.onabort = () => {
          resolve({
            data: null,
            error: new Error('Transaction aborted'),
            message: 'Deletion transaction was aborted',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during project key deletion operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for project key deletion',
    };
  }
}

// Clean up old project keys (for security - remove unused keys after specified time)
export async function cleanupOldProjectKeys(
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000, // Default 30 days
): Promise<ProjectStorageResult<number>> {
  try {
    if (maxAgeMs <= 0) {
      return {
        data: null,
        error: new Error('Invalid max age'),
        message: 'Max age must be positive',
      };
    }

    const db = await initWoshDB();
    const cutoffTime = Date.now() - maxAgeMs;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readwrite');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);
        const index = store.index('lastAccessedAt');
        const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

        let deletedCount = 0;

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to cleanup old project keys',
          });
        };

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            try {
              cursor.delete();
              deletedCount++;
              cursor.continue();
            } catch (error) {
              resolve({
                data: null,
                error,
                message: 'Error deleting old project key during cleanup',
              });
            }
          } else {
            resolve({
              data: deletedCount,
              error: null,
              message: `Successfully cleaned up ${deletedCount} old project keys`,
            });
          }
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed during cleanup',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during cleanup operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for cleanup',
    };
  }
}

// Get storage statistics for project keys
export async function getProjectKeyStorageStats(organizationId?: string): Promise<
  ProjectStorageResult<{
    totalProjects: number;
    storageSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }>
> {
  try {
    const db = await initWoshDB();

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORES.PROJECT_KEYS], 'readonly');
        const store = transaction.objectStore(STORES.PROJECT_KEYS);

        let request: IDBRequest;
        if (organizationId) {
          const index = store.index('organizationId');
          request = index.getAll(organizationId);
        } else {
          request = store.getAll();
        }

        request.onerror = () => {
          resolve({
            data: null,
            error: request.error,
            message: 'Failed to get storage statistics',
          });
        };

        request.onsuccess = () => {
          try {
            const records = request.result as StoredProjectKeyData[];

            let totalSize = 0;
            let oldestEntry: number | null = null;
            let newestEntry: number | null = null;

            records.forEach((record) => {
              // Approximate size calculation
              totalSize += JSON.stringify(record).length * 2; // UTF-16 encoding

              const createdAt = record.createdAt;
              if (!oldestEntry || createdAt < oldestEntry) {
                oldestEntry = createdAt;
              }
              if (!newestEntry || createdAt > newestEntry) {
                newestEntry = createdAt;
              }
            });

            resolve({
              data: {
                totalProjects: records.length,
                storageSize: totalSize,
                oldestEntry,
                newestEntry,
              },
              error: null,
              message: `Storage statistics calculated for ${records.length} projects`,
            });
          } catch (error) {
            resolve({
              data: null,
              error,
              message: 'Error calculating storage statistics',
            });
          }
        };

        transaction.onerror = () => {
          resolve({
            data: null,
            error: transaction.error,
            message: 'Transaction failed while getting statistics',
          });
        };
      } catch (error) {
        resolve({
          data: null,
          error,
          message: 'Error during statistics operation',
        });
      }
    });
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to initialize storage for statistics',
    };
  }
}

// Export the storage interface
export const projectSecureStorage = {
  storeProjectKey,
  getProjectKey,
  getWrappedProjectKey,
  hasProjectKey,
  listProjectsForOrg,
  deleteProjectKey,
  cleanupOldProjectKeys,
  getStorageStats: getProjectKeyStorageStats,
  isAvailable: isSecureStorageAvailable,
};
