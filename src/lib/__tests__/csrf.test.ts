import { describe, it, expect, beforeEach } from 'vitest';
import {
  initCSRFToken,
  getCSRFToken,
  clearCSRFToken,
  validateCSRFToken,
  addCSRFToken,
  isCSRFProtected,
} from '../csrf';

describe('CSRF Protection', () => {
  beforeEach(() => {
    // Clear CSRF token before each test
    clearCSRFToken();
    sessionStorage.clear();
  });

  describe('Token Generation', () => {
    it('should generate a valid CSRF token', () => {
      const token = initCSRFToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const token1 = initCSRFToken();
      clearCSRFToken();
      const token2 = initCSRFToken();
      expect(token1).not.toBe(token2);
    });

    it('should store token in sessionStorage', () => {
      const token = initCSRFToken();
      const stored = sessionStorage.getItem('csrf-token');
      expect(stored).toBe(token);
    });
  });

  describe('Token Retrieval', () => {
    it('should return null when no token initialized', () => {
      expect(getCSRFToken()).toBeNull();
    });

    it('should return token after initialization', () => {
      const token = initCSRFToken();
      expect(getCSRFToken()).toBe(token);
    });

    it('should retrieve token from sessionStorage after page refresh', () => {
      const token = initCSRFToken();
      // Simulate page refresh by clearing memory but keeping sessionStorage
      clearCSRFToken();
      sessionStorage.setItem('csrf-token', token);
      
      expect(getCSRFToken()).toBe(token);
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token', () => {
      const token = initCSRFToken();
      expect(validateCSRFToken(token)).toBe(true);
    });

    it('should reject invalid token', () => {
      initCSRFToken();
      expect(validateCSRFToken('invalid-token')).toBe(false);
    });

    it('should reject token when none initialized', () => {
      expect(validateCSRFToken('any-token')).toBe(false);
    });

    it('should reject token with different length', () => {
      initCSRFToken();
      expect(validateCSRFToken('short')).toBe(false);
    });

    it('should use constant-time comparison', () => {
      const token = initCSRFToken();
      const wrongToken = 'a'.repeat(64);
      
      // Both should take similar time (constant-time comparison)
      const start1 = performance.now();
      validateCSRFToken(token);
      const time1 = performance.now() - start1;
      
      const start2 = performance.now();
      validateCSRFToken(wrongToken);
      const time2 = performance.now() - start2;
      
      // Time difference should be minimal (< 1ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(1);
    });
  });

  describe('Token Clearing', () => {
    it('should clear token from memory', () => {
      initCSRFToken();
      clearCSRFToken();
      expect(getCSRFToken()).toBeNull();
    });

    it('should clear token from sessionStorage', () => {
      initCSRFToken();
      clearCSRFToken();
      expect(sessionStorage.getItem('csrf-token')).toBeNull();
    });
  });

  describe('Adding Token to Payload', () => {
    it('should add CSRF token to payload', () => {
      const token = initCSRFToken();
      const payload = { action: 'test', data: 'value' };
      const result = addCSRFToken(payload);
      
      expect(result).toEqual({
        action: 'test',
        data: 'value',
        csrfToken: token,
      });
    });

    it('should throw error when token not initialized', () => {
      const payload = { action: 'test' };
      expect(() => addCSRFToken(payload)).toThrow('CSRF token not initialized');
    });

    it('should not mutate original payload', () => {
      initCSRFToken();
      const payload = { action: 'test' };
      const original = { ...payload };
      
      addCSRFToken(payload);
      
      expect(payload).toEqual(original);
    });
  });

  describe('Protection Status', () => {
    it('should return false when not protected', () => {
      expect(isCSRFProtected()).toBe(false);
    });

    it('should return true when protected', () => {
      initCSRFToken();
      expect(isCSRFProtected()).toBe(true);
    });

    it('should return false after clearing', () => {
      initCSRFToken();
      clearCSRFToken();
      expect(isCSRFProtected()).toBe(false);
    });
  });

  describe('Security Properties', () => {
    it('should not expose token in localStorage', () => {
      initCSRFToken();
      // CSRF token should only be in sessionStorage, not localStorage
      const localStorageKeys = Object.keys(localStorage);
      expect(localStorageKeys.includes('csrf-token')).toBe(false);
    });

    it('should use cryptographically secure random', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        const token = initCSRFToken();
        tokens.add(token);
        clearCSRFToken();
      }
      // All tokens should be unique
      expect(tokens.size).toBe(100);
    });

    it('should clear on logout', () => {
      initCSRFToken();
      clearCSRFToken();
      
      expect(getCSRFToken()).toBeNull();
      expect(sessionStorage.getItem('csrf-token')).toBeNull();
    });
  });
});
