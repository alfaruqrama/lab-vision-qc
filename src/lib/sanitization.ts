import DOMPurify from 'dompurify';

/**
 * Input Sanitization Module
 * 
 * Provides comprehensive XSS protection for user inputs.
 * Uses DOMPurify for HTML sanitization and custom validators for specific fields.
 */

// ============================================
// HTML Sanitization
// ============================================

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes dangerous tags and attributes
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitize HTML but allow more tags (for rich text editors)
 */
export function sanitizeRichText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
    ],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Strip all HTML tags completely
 */
export function stripHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });
}

// ============================================
// Field-Specific Sanitization
// ============================================

/**
 * Sanitize lot number (alphanumeric, dash, underscore only)
 */
export function sanitizeLotNumber(input: string): string {
  return input
    .trim()
    .replace(/[^A-Za-z0-9\-_]/g, '')
    .slice(0, 50); // Max 50 chars
}

/**
 * Sanitize analyst name (letters, spaces, dots only)
 */
export function sanitizeAnalystName(input: string): string {
  return input
    .trim()
    .replace(/[^A-Za-z\s.]/g, '')
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .slice(0, 100); // Max 100 chars
}

/**
 * Sanitize notes/comments (remove dangerous characters)
 */
export function sanitizeNotes(input: string): string {
  // Remove HTML tags but keep content
  const stripped = stripHTML(input);
  
  // Remove dangerous patterns
  return stripped
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<script/gi, '')
    .replace(/<\/script>/gi, '')
    .trim()
    .slice(0, 500); // Max 500 chars
}

/**
 * Sanitize username (alphanumeric, dash, underscore, dot only)
 */
export function sanitizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, '')
    .slice(0, 50); // Max 50 chars
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@.\-_+]/g, '')
    .slice(0, 100); // Max 100 chars
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Check if string contains potential XSS patterns
 */
export function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /expression\(/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Check if string contains SQL injection patterns
 */
export function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|;|\/\*|\*\/)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /('|")\s*(OR|AND)\s*('|")/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Validate and sanitize file name
 */
export function sanitizeFileName(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9\-_.]/g, '_')
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .slice(0, 255); // Max 255 chars (filesystem limit)
}

// ============================================
// Batch Sanitization
// ============================================

/**
 * Sanitize an object's string fields
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fieldSanitizers: Partial<Record<keyof T, (value: string) => string>>
): T {
  const sanitized = { ...obj };
  
  for (const [key, sanitizer] of Object.entries(fieldSanitizers)) {
    const value = obj[key as keyof T];
    if (typeof value === 'string' && sanitizer) {
      sanitized[key as keyof T] = sanitizer(value) as T[keyof T];
    }
  }
  
  return sanitized;
}

/**
 * Sanitize QC record before submission
 */
export function sanitizeQCRecord(record: {
  lot: string;
  analis: string;
  catatan: string;
  [key: string]: unknown;
}): typeof record {
  return sanitizeObject(record, {
    lot: sanitizeLotNumber,
    analis: sanitizeAnalystName,
    catatan: sanitizeNotes,
  });
}

/**
 * Sanitize user data before submission
 */
export function sanitizeUserData(user: {
  username: string;
  nama: string;
  email?: string;
  [key: string]: unknown;
}): typeof user {
  return sanitizeObject(user, {
    username: sanitizeUsername,
    nama: sanitizeAnalystName,
    email: user.email ? sanitizeEmail : undefined,
  });
}

// ============================================
// Export Configuration
// ============================================

/**
 * Configure DOMPurify hooks (called once on app init)
 */
export function configureSanitization(): void {
  // Add hook to remove data attributes that could be exploited
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Remove all data-* attributes except whitelisted ones
    const allowedDataAttrs = ['data-testid'];
    
    if (node.hasAttributes()) {
      const attrs = Array.from(node.attributes);
      attrs.forEach((attr) => {
        if (attr.name.startsWith('data-') && !allowedDataAttrs.includes(attr.name)) {
          node.removeAttribute(attr.name);
        }
      });
    }
  });
}
