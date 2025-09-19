/**
 * Secure storage interface for organization keys
 * Uses IndexedDB for persistence with additional security layers
 */

import { StoredOrgKeys } from '@/types/encryptions';

const DB_NAME = 'wosh-secure-storage';
const DB_VERSION = 1;
const STORE_NAME = 'organization-keys';

export interface StorageError extends Error {
  code: 'STORAGE_UNAVAILABLE' | 'KEY_NOT_FOUND' | 'ENCRYPTION_ERROR' | 'ACCESS_DENIED';
}

class SecureStorageManager {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB connection
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = new Error('Failed to open secure storage') as StorageError;
        error.code = 'STORAGE_UNAVAILABLE';
        reject(error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        // Create object store for organization keys
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'orgId' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * Store organization keys securely
   */
  async storeOrgKeys(orgId: string, userId: string, keys: StoredOrgKeys): Promise<void> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        orgId,
        userId,
        ...keys,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          const error = new Error('Failed to store organization keys') as StorageError;
          error.code = 'ENCRYPTION_ERROR';
          reject(error);
        };
      });
    } catch (error) {
      console.error('Error storing organization keys:', error);
      throw error;
    }
  }

  /**
   * Retrieve organization keys
   */
  async getOrgKeys(orgId: string, userId: string): Promise<StoredOrgKeys | null> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(orgId);

        request.onsuccess = () => {
          const record = request.result;

          if (!record) {
            resolve(null);
            return;
          }

          // Verify user ownership
          if (record.userId !== userId) {
            const error = new Error('Access denied to organization keys') as StorageError;
            error.code = 'ACCESS_DENIED';
            reject(error);
            return;
          }

          // Update last accessed time
          this.updateLastAccessed(orgId).catch(console.error);

          resolve({
            publicKey: record.publicKey,
            privateKeyEncrypted: record.privateKeyEncrypted,
            salt: record.salt,
            iv: record.iv,
          });
        };

        request.onerror = () => {
          const error = new Error('Failed to retrieve organization keys') as StorageError;
          error.code = 'KEY_NOT_FOUND';
          reject(error);
        };
      });
    } catch (error) {
      console.error('Error retrieving organization keys:', error);
      throw error;
    }
  }

  /**
   * Check if organization keys exist
   */
  async hasOrgKeys(orgId: string, userId: string): Promise<boolean> {
    try {
      const keys = await this.getOrgKeys(orgId, userId);
      return keys !== null;
    } catch (error) {
      console.error('Error checking if organization keys exist:', error);
      return false;
    }
  }

  /**
   * Remove organization keys
   */
  async removeOrgKeys(orgId: string, userId: string): Promise<void> {
    try {
      const db = await this.initDB();

      // First verify ownership
      const existing = await this.getOrgKeys(orgId, userId);
      if (!existing) {
        throw new Error('Organization keys not found');
      }

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(orgId);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          const error = new Error('Failed to remove organization keys') as StorageError;
          error.code = 'ENCRYPTION_ERROR';
          reject(error);
        };
      });
    } catch (error) {
      console.error('Error removing organization keys:', error);
      throw error;
    }
  }

  /**
   * List all organizations for a user
   */
  async listUserOrganizations(userId: string): Promise<
    Array<{
      orgId: string;
      publicKey: string;
      createdAt: string;
      lastAccessed: string;
    }>
  > {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userId');

      return new Promise((resolve, reject) => {
        const request = index.getAll(userId);

        request.onsuccess = () => {
          const records = request.result.map((record) => ({
            orgId: record.orgId,
            publicKey: record.publicKey,
            createdAt: record.createdAt,
            lastAccessed: record.lastAccessed,
          }));

          resolve(records);
        };

        request.onerror = () => {
          const error = new Error('Failed to list organizations') as StorageError;
          error.code = 'STORAGE_UNAVAILABLE';
          reject(error);
        };
      });
    } catch (error) {
      console.error('Error listing organizations:', error);
      throw error;
    }
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(orgId: string): Promise<void> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(orgId);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.lastAccessed = new Date().toISOString();
          store.put(record);
        }
      };
    } catch (error) {
      // Non-critical error, don't throw
      console.warn('Failed to update last accessed time:', error);
    }
  }

  /**
   * Clear all stored keys (for logout/reset)
   */
  async clearAllKeys(): Promise<void> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
          const error = new Error('Failed to clear storage') as StorageError;
          error.code = 'STORAGE_UNAVAILABLE';
          reject(error);
        };
      });
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * Check if secure storage is available
   */
  static isAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined';
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    totalOrganizations: number;
    storageSize: number; // Approximate size in bytes
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const records = request.result;

          let totalSize = 0;
          let oldestEntry: string | null = null;
          let newestEntry: string | null = null;

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
            totalOrganizations: records.length,
            storageSize: totalSize,
            oldestEntry,
            newestEntry,
          });
        };

        request.onerror = () => {
          const error = new Error('Failed to get storage stats') as StorageError;
          error.code = 'STORAGE_UNAVAILABLE';
          reject(error);
        };
      });
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const secureStorage = new SecureStorageManager();

// Export utility functions
export const isSecureStorageAvailable = SecureStorageManager.isAvailable;
