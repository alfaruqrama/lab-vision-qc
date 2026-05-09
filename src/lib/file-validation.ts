import imageCompression from 'browser-image-compression';

/**
 * File Upload Validation & Compression
 * 
 * Provides security validation and optimization for file uploads.
 */

// ============================================
// Constants
// ============================================

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

// ============================================
// Validation
// ============================================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSize: number = MAX_FILE_SIZE): FileValidationResult {
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Ukuran file terlalu besar (${fileSizeMB}MB). Maksimal ${maxSizeMB}MB.`,
    };
  }
  
  return { valid: true, file };
}

/**
 * Validate file type
 */
export function validateFileType(file: File, allowedTypes: string[] = ALLOWED_IMAGE_TYPES): FileValidationResult {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Tipe file tidak didukung. Hanya ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}.`,
    };
  }
  
  return { valid: true, file };
}

/**
 * Validate file extension
 */
export function validateFileExtension(file: File, allowedExtensions: string[] = ALLOWED_EXTENSIONS): FileValidationResult {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Ekstensi file tidak didukung. Hanya ${allowedExtensions.join(', ')}.`,
    };
  }
  
  return { valid: true, file };
}

/**
 * Comprehensive file validation
 */
export function validateFile(file: File): FileValidationResult {
  // Check file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) return sizeValidation;
  
  // Check file type
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) return typeValidation;
  
  // Check file extension
  const extensionValidation = validateFileExtension(file);
  if (!extensionValidation.valid) return extensionValidation;
  
  return { valid: true, file };
}

// ============================================
// Compression
// ============================================

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  onProgress?: (progress: number) => void;
}

/**
 * Compress image if needed
 */
export async function compressImageIfNeeded(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxSizeMB = 1.5,
    maxWidthOrHeight = 1920,
    useWebWorker = true,
    onProgress,
  } = options;
  
  // Skip compression if file is already small
  if (file.size <= COMPRESSION_THRESHOLD) {
    return file;
  }
  
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker,
      onProgress,
    });
    
    // Only use compressed version if it's actually smaller
    return compressed.size < file.size ? compressed : file;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return file;
  }
}

// ============================================
// File Reading
// ============================================

/**
 * Read file as base64 data URL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Extract base64 data and media type from data URL
 */
export function parseDataURL(dataURL: string): { data: string; mediaType: string } {
  const matches = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  
  if (!matches) {
    throw new Error('Invalid data URL format');
  }
  
  return {
    mediaType: matches[1],
    data: matches[2],
  };
}

// ============================================
// Complete Upload Flow
// ============================================

export interface ProcessFileOptions {
  compress?: boolean;
  compressionOptions?: CompressionOptions;
  onProgress?: (stage: string, progress: number) => void;
}

export interface ProcessedFile {
  original: File;
  processed: File;
  dataURL: string;
  base64: string;
  mediaType: string;
  compressed: boolean;
  originalSize: number;
  processedSize: number;
}

/**
 * Complete file processing: validate → compress → read
 */
export async function processFile(
  file: File,
  options: ProcessFileOptions = {}
): Promise<ProcessedFile> {
  const {
    compress = true,
    compressionOptions = {},
    onProgress,
  } = options;
  
  // Stage 1: Validation
  if (onProgress) onProgress('Validating', 0);
  
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Stage 2: Compression (if needed)
  let processed = file;
  let compressed = false;
  
  if (compress && file.size > COMPRESSION_THRESHOLD) {
    if (onProgress) onProgress('Compressing', 30);
    
    processed = await compressImageIfNeeded(file, {
      ...compressionOptions,
      onProgress: (progress) => {
        if (onProgress) onProgress('Compressing', 30 + progress * 0.4);
      },
    });
    
    compressed = processed.size < file.size;
  }
  
  // Stage 3: Read as data URL
  if (onProgress) onProgress('Reading', 70);
  
  const dataURL = await readFileAsDataURL(processed);
  const { data, mediaType } = parseDataURL(dataURL);
  
  if (onProgress) onProgress('Complete', 100);
  
  return {
    original: file,
    processed,
    dataURL,
    base64: data,
    mediaType,
    compressed,
    originalSize: file.size,
    processedSize: processed.size,
  };
}

// ============================================
// Helpers
// ============================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100);
}
