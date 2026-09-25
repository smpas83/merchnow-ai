import { StorageObject } from '../types.js';

export interface StorageProvider {
  /**
   * Store a file. Returns the storage key/path.
   */
  store(fileBuffer: Buffer, filename: string, contentType: string): Promise<string>;

  /**
   * Retrieve a file by its storage key.
   */
  retrieve(key: string): Promise<StorageObject>;

  /**
   * Delete a file by its storage key.
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists.
   */
  exists(key: string): Promise<boolean>;
}

export interface StorageObject {
  key: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  metadata?: Record<string, string>;
}