const DB_NAME = 'wosh';
const DB_VERSION = 1;

// Store names
export const STORES = {
  ORG_KEYS: 'wosh-org-keys',
  PROJECT_KEYS: 'wosh-project-keys',
} as const;

export type StoreResult<T> = {
  data: T | null;
  error: unknown;
  message: string;
};

interface StoreConfig {
  name: string;
  keyPath: string;
  indices?: {
    name: string;
    keyPath: string | string[];
    options?: IDBIndexParameters;
  }[];
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    name: STORES.ORG_KEYS,
    keyPath: 'organizationId',
    indices: [
      { name: 'userId', keyPath: 'userId', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
      { name: 'lastAccessed', keyPath: 'lastAccessed', options: { unique: false } },
    ],
  },
  {
    name: STORES.PROJECT_KEYS,
    keyPath: 'projectId',
    indices: [
      { name: 'organizationId', keyPath: 'organizationId', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
      { name: 'lastAccessedAt', keyPath: 'lastAccessedAt', options: { unique: false } },
    ],
  },
];

export function initWoshDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject({
          error: request.error,
          message: 'Failed to open Wosh database',
        });
      };

      request.onsuccess = () => {
        const db = request.result;

        // Verify all required stores exist
        const missingStores = STORE_CONFIGS.filter(
          (config) => !db.objectStoreNames.contains(config.name),
        );

        if (missingStores.length > 0) {
          db.close();
          reject({
            error: new Error('Missing object stores'),
            message: `Missing stores: ${missingStores.map((s) => s.name).join(', ')}. Please clear browser data and try again.`,
          });
          return;
        }

        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = request.result;
          const oldVersion = event.oldVersion;

          console.log(`Upgrading Wosh database from version ${oldVersion} to ${DB_VERSION}`);

          // Create all stores and their indices
          STORE_CONFIGS.forEach((config) => {
            // Delete existing store if it exists (for clean upgrade)
            if (db.objectStoreNames.contains(config.name)) {
              db.deleteObjectStore(config.name);
            }

            // Create the object store
            const store = db.createObjectStore(config.name, { keyPath: config.keyPath });

            // Create indices
            if (config.indices) {
              config.indices.forEach((index) => {
                store.createIndex(index.name, index.keyPath, index.options);
              });
            }

            console.log(`Created store: ${config.name}`);
          });

          console.log('Wosh database schema created successfully');
        } catch (upgradeError) {
          console.error('Database upgrade error:', upgradeError);
          reject({
            error: upgradeError,
            message: 'Failed to upgrade Wosh database schema',
          });
        }
      };

      request.onblocked = () => {
        reject({
          error: new Error('Database upgrade blocked'),
          message: 'Database upgrade blocked. Please close other tabs and try again.',
        });
      };
    } catch (error) {
      reject({
        error,
        message: 'Failed to initialize Wosh database',
      });
    }
  });
}

export function isSecureStorageAvailable(): StoreResult<boolean> {
  try {
    const hasIndexedDB = typeof indexedDB !== 'undefined' && indexedDB !== null;
    const hasCrypto = typeof crypto !== 'undefined' && crypto.subtle !== undefined;

    if (!hasIndexedDB) {
      return {
        data: false,
        error: new Error('IndexedDB not available'),
        message: 'IndexedDB is not supported in this browser',
      };
    }

    if (!hasCrypto) {
      return {
        data: false,
        error: new Error('Web Crypto API not available'),
        message: 'Web Crypto API is not supported in this browser',
      };
    }

    return {
      data: true,
      error: null,
      message: 'Secure storage is available',
    };
  } catch (error) {
    return {
      data: false,
      error,
      message: 'Error checking secure storage availability',
    };
  }
}
