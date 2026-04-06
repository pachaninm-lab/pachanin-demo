import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface StoredFile {
  id: string;
  name: string;
  content: string | Buffer;
  mimeType: string;
  createdAt: string;
}

@Injectable()
export class StorageService {
  private readonly files = new Map<string, StoredFile>();

  upload(file: { name: string; content: string | Buffer; mimeType: string }) {
    const id = randomUUID();
    const stored: StoredFile = {
      id,
      ...file,
      createdAt: new Date().toISOString(),
    };
    this.files.set(id, stored);
    return { id, name: file.name, mimeType: file.mimeType, createdAt: stored.createdAt };
  }

  get(id: string) {
    const file = this.files.get(id);
    if (!file) throw new NotFoundException(`File not found: ${id}`);
    return file;
  }

  delete(id: string) {
    const existed = this.files.has(id);
    this.files.delete(id);
    return { id, deleted: existed };
  }
}
