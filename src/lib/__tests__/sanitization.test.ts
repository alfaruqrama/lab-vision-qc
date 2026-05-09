import { describe, it, expect, beforeAll } from 'vitest';
import {
  sanitizeHTML,
  sanitizeRichText,
  stripHTML,
  sanitizeLotNumber,
  sanitizeAnalystName,
  sanitizeNotes,
  sanitizeUsername,
  sanitizeEmail,
  sanitizeFileName,
  containsXSS,
  containsSQLInjection,
  sanitizeQCRecord,
  sanitizeUserData,
  configureSanitization,
} from '../sanitization';

describe('Input Sanitization', () => {
  beforeAll(() => {
    configureSanitization();
  });

  describe('HTML Sanitization', () => {
    it('should remove script tags', () => {
      const dirty = '<script>alert("xss")</script>Hello';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Hello');
    });

    it('should remove event handlers', () => {
      const dirty = '<div onclick="alert(1)">Click me</div>';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('onclick');
    });

    it('should allow safe tags', () => {
      const dirty = '<b>Bold</b> <i>Italic</i> <strong>Strong</strong>';
      const clean = sanitizeHTML(dirty);
      expect(clean).toContain('<b>Bold</b>');
      expect(clean).toContain('<i>Italic</i>');
      expect(clean).toContain('<strong>Strong</strong>');
    });

    it('should remove dangerous attributes', () => {
      const dirty = '<img src="x" onerror="alert(1)">';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('onerror');
    });
  });

  describe('Rich Text Sanitization', () => {
    it('should allow more tags for rich text', () => {
      const dirty = '<h1>Title</h1><ul><li>Item</li></ul>';
      const clean = sanitizeRichText(dirty);
      expect(clean).toContain('<h1>Title</h1>');
      expect(clean).toContain('<ul><li>Item</li></ul>');
    });

    it('should still remove dangerous tags', () => {
      const dirty = '<h1>Title</h1><script>alert(1)</script>';
      const clean = sanitizeRichText(dirty);
      expect(clean).toContain('<h1>Title</h1>');
      expect(clean).not.toContain('<script>');
    });
  });

  describe('Strip HTML', () => {
    it('should remove all HTML tags', () => {
      const dirty = '<b>Bold</b> <i>Italic</i> Text';
      const clean = stripHTML(dirty);
      expect(clean).toBe('Bold Italic Text');
    });

    it('should keep text content', () => {
      const dirty = '<div><p>Hello <span>World</span></p></div>';
      const clean = stripHTML(dirty);
      expect(clean).toBe('Hello World');
    });
  });

  describe('Lot Number Sanitization', () => {
    it('should allow alphanumeric, dash, underscore', () => {
      expect(sanitizeLotNumber('LOT-2024_001')).toBe('LOT-2024_001');
    });

    it('should remove special characters', () => {
      expect(sanitizeLotNumber('LOT@2024#001')).toBe('LOT2024001');
    });

    it('should trim whitespace', () => {
      expect(sanitizeLotNumber('  LOT-001  ')).toBe('LOT-001');
    });

    it('should limit length to 50 chars', () => {
      const long = 'A'.repeat(100);
      expect(sanitizeLotNumber(long).length).toBe(50);
    });
  });

  describe('Analyst Name Sanitization', () => {
    it('should allow letters, spaces, dots', () => {
      expect(sanitizeAnalystName('Dr. John Doe')).toBe('Dr. John Doe');
    });

    it('should remove numbers and special chars', () => {
      expect(sanitizeAnalystName('Dr. John123 Doe!')).toBe('Dr. John Doe');
    });

    it('should normalize multiple spaces', () => {
      expect(sanitizeAnalystName('John    Doe')).toBe('John Doe');
    });

    it('should limit length to 100 chars', () => {
      const long = 'A'.repeat(200);
      expect(sanitizeAnalystName(long).length).toBe(100);
    });
  });

  describe('Notes Sanitization', () => {
    it('should remove HTML tags', () => {
      const notes = '<b>Important:</b> Check results';
      const clean = sanitizeNotes(notes);
      expect(clean).not.toContain('<b>');
      expect(clean).toContain('Important: Check results');
    });

    it('should remove javascript: protocol', () => {
      const notes = 'Click javascript:alert(1)';
      const clean = sanitizeNotes(notes);
      expect(clean).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const notes = 'Text onclick=alert(1)';
      const clean = sanitizeNotes(notes);
      expect(clean).not.toContain('onclick=');
    });

    it('should limit length to 500 chars', () => {
      const long = 'A'.repeat(1000);
      expect(sanitizeNotes(long).length).toBe(500);
    });
  });

  describe('Username Sanitization', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeUsername('JohnDoe')).toBe('johndoe');
    });

    it('should allow alphanumeric, dash, underscore, dot', () => {
      expect(sanitizeUsername('john.doe_123')).toBe('john.doe_123');
    });

    it('should remove special characters', () => {
      expect(sanitizeUsername('john@doe!')).toBe('johndoe');
    });

    it('should limit length to 50 chars', () => {
      const long = 'a'.repeat(100);
      expect(sanitizeUsername(long).length).toBe(50);
    });
  });

  describe('Email Sanitization', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeEmail('John@Example.COM')).toBe('john@example.com');
    });

    it('should allow valid email characters', () => {
      expect(sanitizeEmail('john.doe+test@example.com')).toBe('john.doe+test@example.com');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeEmail('john doe@example.com')).toBe('johndoe@example.com');
    });
  });

  describe('File Name Sanitization', () => {
    it('should replace spaces with underscores', () => {
      expect(sanitizeFileName('my file.txt')).toBe('my_file.txt');
    });

    it('should replace special characters', () => {
      // Special chars are replaced with underscore, then collapsed
      expect(sanitizeFileName('file@#$%.txt')).toBe('file_.txt');
    });

    it('should collapse multiple underscores', () => {
      expect(sanitizeFileName('file___name.txt')).toBe('file_name.txt');
    });

    it('should limit length to 255 chars', () => {
      const long = 'a'.repeat(300) + '.txt';
      expect(sanitizeFileName(long).length).toBe(255);
    });
  });

  describe('XSS Detection', () => {
    it('should detect script tags', () => {
      expect(containsXSS('<script>alert(1)</script>')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      expect(containsXSS('javascript:alert(1)')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsXSS('onclick=alert(1)')).toBe(true);
    });

    it('should detect iframe tags', () => {
      expect(containsXSS('<iframe src="evil.com"></iframe>')).toBe(true);
    });

    it('should not flag safe content', () => {
      expect(containsXSS('Normal text content')).toBe(false);
    });
  });

  describe('SQL Injection Detection', () => {
    it('should detect SELECT statements', () => {
      expect(containsSQLInjection("' OR 1=1; SELECT * FROM users--")).toBe(true);
    });

    it('should detect OR conditions', () => {
      expect(containsSQLInjection("admin' OR '1'='1")).toBe(true);
    });

    it('should detect comment patterns', () => {
      expect(containsSQLInjection("admin'--")).toBe(true);
    });

    it('should not flag safe content', () => {
      expect(containsSQLInjection('Normal username')).toBe(false);
    });
  });

  describe('QC Record Sanitization', () => {
    it('should sanitize all fields', () => {
      const dirty = {
        lot: 'LOT@2024#001',
        analis: 'Dr. John123',
        catatan: '<script>alert(1)</script>Normal note',
        other: 'unchanged',
      };

      const clean = sanitizeQCRecord(dirty);

      expect(clean.lot).toBe('LOT2024001');
      expect(clean.analis).toBe('Dr. John');
      expect(clean.catatan).not.toContain('<script>');
      expect(clean.other).toBe('unchanged');
    });
  });

  describe('User Data Sanitization', () => {
    it('should sanitize user fields', () => {
      const dirty = {
        username: 'John@Doe!',
        nama: 'John123 Doe',
        email: 'JOHN@EXAMPLE.COM',
        role: 'admin',
      };

      const clean = sanitizeUserData(dirty);

      expect(clean.username).toBe('johndoe');
      expect(clean.nama).toBe('John Doe');
      expect(clean.email).toBe('john@example.com');
      expect(clean.role).toBe('admin');
    });

    it('should handle missing email', () => {
      const dirty = {
        username: 'johndoe',
        nama: 'John Doe',
      };

      const clean = sanitizeUserData(dirty);

      expect(clean.username).toBe('johndoe');
      expect(clean.nama).toBe('John Doe');
    });
  });
});
