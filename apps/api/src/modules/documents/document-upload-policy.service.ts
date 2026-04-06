import { BadRequestException, Injectable } from '@nestjs/common';
import { basename, extname } from 'path';

const ALLOWED = new Map<string, string[]>([
  ['application/pdf', ['.pdf']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx']]
]);

const DENY_EXTENSIONS = new Set([
  '.exe', '.dll', '.js', '.mjs', '.cjs', '.html', '.htm', '.svg', '.bat', '.cmd', '.ps1', '.jar', '.msi', '.apk', '.sh', '.php'
]);

function startsWithBytes(input: Buffer, bytes: number[]) {
  return bytes.every((value, index) => input[index] === value);
}

@Injectable()
export class DocumentUploadPolicyService {
  validate(file: any) {
    if (!file) throw new BadRequestException('File is required');
    const maxBytes = Number(process.env.MAX_DOCUMENT_SIZE_BYTES ?? 15 * 1024 * 1024);
    if (file.size > maxBytes) throw new BadRequestException('File exceeds max size');

    const originalName = basename(String(file.originalname || '').trim());
    if (!originalName || originalName === '.' || originalName === '..') {
      throw new BadRequestException('Invalid file name');
    }
    if (/\0|\.\.|[<>:"|?*]/.test(originalName)) {
      throw new BadRequestException('Unsafe file name');
    }

    const extension = extname(originalName).toLowerCase();
    if (DENY_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Unsupported file type');
    }

    const allowedExtensions = ALLOWED.get(file.mimetype);
    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      throw new BadRequestException('Unsupported file type');
    }

    const signatureKind = this.detectSignature(file.buffer);
    if (!this.signatureMatches(file.mimetype, signatureKind)) {
      throw new BadRequestException('File content does not match declared type');
    }

    return {
      safeOriginalName: originalName,
      extension,
      mimeType: file.mimetype,
      signatureKind
    };
  }

  private detectSignature(buffer: Buffer): 'pdf' | 'jpeg' | 'png' | 'zip' | 'unknown' {
    if (!buffer || buffer.length < 4) return 'unknown';
    if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
    if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';
    if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04])) return 'zip';
    return 'unknown';
  }

  private signatureMatches(mimeType: string, signature: ReturnType<DocumentUploadPolicyService['detectSignature']>) {
    if (mimeType === 'application/pdf') return signature === 'pdf';
    if (mimeType === 'image/jpeg') return signature === 'jpeg';
    if (mimeType === 'image/png') return signature === 'png';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return signature === 'zip';
    return false;
  }
}
