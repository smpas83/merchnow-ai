import fs from 'fs';
import path from 'path';

/**
 * Create a backup of the SQLite database.
 * Returns the path to the backup file.
 */
export function createBackup(dbPath: string, backupDir?: string): string {
  const resolvedDbPath = path.resolve(dbPath);
  if (!fs.existsSync(resolvedDbPath)) {
    throw new Error(`Database not found: ${resolvedDbPath}`);
  }

  const targetDir = backupDir || path.dirname(resolvedDbPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `merchnow_backup_${timestamp}.db`;
  const backupPath = path.join(targetDir, backupName);

  fs.copyFileSync(resolvedDbPath, backupPath);

  // Set reasonable permissions
  fs.chmodSync(backupPath, 0o600);

  return backupPath;
}

/**
 * Verify that a backup file is a valid SQLite database.
 */
export function verifyBackup(backupPath: string): boolean {
  try {
    const stats = fs.statSync(backupPath);
    if (stats.size < 100) return false; // SQLite header is 100 bytes

    const buffer = fs.readFileSync(backupPath);
    // SQLite magic header: "SQLite format 3\000"
    const magic = buffer.slice(0, 16).toString('ascii');
    return magic.startsWith('SQLite format 3');
  } catch {
    return false;
  }
}

/**
 * List all backups in a directory, sorted newest first.
 */
export function listBackups(backupDir: string): string[] {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('merchnow_backup_') && f.endsWith('.db'))
    .map(f => path.join(backupDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files;
}

/**
 * Delete old backups, keeping the newest `keepCount`.
 */
export function pruneBackups(backupDir: string, keepCount: number = 7): string[] {
  const backups = listBackups(backupDir);
  if (backups.length <= keepCount) return [];

  const toDelete = backups.slice(keepCount);
  for (const bp of toDelete) {
    fs.unlinkSync(bp);
  }
  return toDelete;
}