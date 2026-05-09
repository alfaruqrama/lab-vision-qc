import { describe, it, expect } from 'vitest';
import {
  validateFileSize,
  validateFileType,
  validateFileExtension,
  validateFile,
  formatFileSize,
  getCompressionRatio,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
} from '../file-validation';

describe('File Upload Validation', () => {
  // Helper to create mock File
  function createMockFile(
    name: string,
    size: number,
    type: string
  ): File {
    const blob = new Blob(['x'.repeat(size)], { type });
    return new File([blob], name, { type });
  }

  describe('File Size Validation', () => {
    it('should accept files under max size', () => {
      const file = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg'); // 1MB
      const result = validateFileSize(file);
      expect(result.valid).toBe(true);
      expect(result.file).toBe(file);
    });

    it('should reject files over max size', () => {
      const file = createMockFile('test.jpg', 10 * 1024 * 1024, 'image/jpeg'); // 10MB
      const result = validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terlalu besar');
      expect(result.error).toContain('10.0MB');
    });

    it('should accept files exactly at max size', () => {
      const file = createMockFile('test.jpg', MAX_FILE_SIZE, 'image/jpeg');
      const result = validateFileSize(file);
      expect(result.valid).toBe(true);
    });

    it('should use custom max size', () => {
      const file = createMockFile('test.jpg', 2 * 1024 * 1024, 'image/jpeg'); // 2MB
      const result = validateFileSize(file, 1 * 1024 * 1024); // 1MB max
      expect(result.valid).toBe(false);
    });
  });

  describe('File Type Validation', () => {
    it('should accept JPEG files', () => {
      const file = createMockFile('test.jpg', 1024, 'image/jpeg');
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('should accept PNG files', () => {
      const file = createMockFile('test.png', 1024, 'image/png');
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('should reject PDF files', () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      const result = validateFileType(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak didukung');
    });

    it('should reject GIF files', () => {
      const file = createMockFile('test.gif', 1024, 'image/gif');
      const result = validateFileType(file);
      expect(result.valid).toBe(false);
    });

    it('should use custom allowed types', () => {
      const file = createMockFile('test.gif', 1024, 'image/gif');
      const result = validateFileType(file, ['image/gif']);
      expect(result.valid).toBe(true);
    });
  });

  describe('File Extension Validation', () => {
    it('should accept .jpg extension', () => {
      const file = createMockFile('test.jpg', 1024, 'image/jpeg');
      const result = validateFileExtension(file);
      expect(result.valid).toBe(true);
    });

    it('should accept .jpeg extension', () => {
      const file = createMockFile('test.jpeg', 1024, 'image/jpeg');
      const result = validateFileExtension(file);
      expect(result.valid).toBe(true);
    });

    it('should accept .png extension', () => {
      const file = createMockFile('test.png', 1024, 'image/png');
      const result = validateFileExtension(file);
      expect(result.valid).toBe(true);
    });

    it('should reject .pdf extension', () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      const result = validateFileExtension(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak didukung');
    });

    it('should be case insensitive', () => {
      const file = createMockFile('test.JPG', 1024, 'image/jpeg');
      const result = validateFileExtension(file);
      expect(result.valid).toBe(true);
    });

    it('should handle files without extension', () => {
      const file = createMockFile('test', 1024, 'image/jpeg');
      const result = validateFileExtension(file);
      expect(result.valid).toBe(false);
    });
  });

  describe('Complete File Validation', () => {
    it('should accept valid image files', () => {
      const file = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg');
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.file).toBe(file);
    });

    it('should reject files that fail size check', () => {
      const file = createMockFile('test.jpg', 10 * 1024 * 1024, 'image/jpeg');
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terlalu besar');
    });

    it('should reject files that fail type check', () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak didukung');
    });

    it('should reject files that fail extension check', () => {
      const file = createMockFile('test.gif', 1024, 'image/gif');
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });
  });

  describe('Format File Size', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should round to 1 decimal place', () => {
      expect(formatFileSize(1234)).toBe('1.2 KB');
      expect(formatFileSize(1234567)).toBe('1.2 MB');
    });
  });

  describe('Compression Ratio', () => {
    it('should calculate compression ratio', () => {
      const ratio = getCompressionRatio(1000, 500);
      expect(ratio).toBe(50);
    });

    it('should handle no compression', () => {
      const ratio = getCompressionRatio(1000, 1000);
      expect(ratio).toBe(0);
    });

    it('should handle high compression', () => {
      const ratio = getCompressionRatio(1000, 100);
      expect(ratio).toBe(90);
    });

    it('should round to nearest integer', () => {
      const ratio = getCompressionRatio(1000, 667);
      expect(ratio).toBe(33);
    });
  });
});
