import path from 'path';
import fs from 'fs';
import { StorageProvider, StorageObject } from './storage.js';
import { UPLOAD_DIR } from './uploads_server.js';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || UPLOAD_DIR;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async store(fileBuffer: Buffer, filename: string, contentType: string): Promise<string> {
    const safeName = this.sanitizeFilename(filename);
    const filePath = path.join(this.baseDir, safeName);
    fs.writeFileSync(filePath, fileBuffer);
    return safeName;
  }

  async retrieve(key: string): Promise<StorageObject> {
    const safeKey = this.sanitizeFilename(key);
    const filePath = path.join(this.baseDir, safeKey);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    const stats = fs.statSync(filePath);
    return {
      key: safeKey,
      filename: path.basename(safeKey),
      contentType: this.guessContentType(safeKey),
      size: stats.size,
      url: `/api/proof/files/${safeKey}`,
    };
  }

  async delete(key: string): Promise<void> {
    const safeKey = this.sanitizeFilename(key);
    const filePath = path.join(this.baseDir, safeKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const safeKey = this.sanitizeFilename(key);
    return fs.existsSync(path.join(this.baseDir, safeKey));
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private guessContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
    };
    return map[ext] || 'application/octet-stream';
  }
}