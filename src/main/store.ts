import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

type StoreData = Record<string, unknown>;

/**
 * Lightweight JSON-based persistent store with safeStorage encryption.
 * Replaces electron-store to meet "Store securely" requirement.
 */
export class Store {
  private data: StoreData = {};
  private filePath: string;

  constructor(name: string) {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, `${name}.bin`); // Changed extension to .bin to reflect encryption
    this.load();
  }

  private load(): void {
    try {
      const buffer = fs.readFileSync(this.filePath);
      let decrypted: string;

      if (safeStorage.isEncryptionAvailable()) {
        try {
          decrypted = safeStorage.decryptString(buffer);
        } catch {
          // Decryption failed — file may be unencrypted (migration from older version)
          decrypted = buffer.toString('utf-8');
        }
      } else {
        decrypted = buffer.toString('utf-8');
      }

      this.data = JSON.parse(decrypted) as StoreData;
    } catch {
      this.data = {};
    }
  }

  private save(): void {
    const raw = JSON.stringify(this.data);
    let buffer: Buffer;

    if (safeStorage.isEncryptionAvailable()) {
      buffer = safeStorage.encryptString(raw);
    } else {
      buffer = Buffer.from(raw, 'utf-8');
    }

    // Atomic write: write to a temp file first, then rename to avoid corruption on crash
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, this.filePath);
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.save();
  }

  delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  clear(): void {
    this.data = {};
    this.save();
  }
}

export default Store;
