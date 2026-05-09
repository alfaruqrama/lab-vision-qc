/**
 * CSRF Protection Module
 * 
 * Generates and validates CSRF tokens for state-changing requests.
 * Token is stored in memory (not localStorage) for security.
 */

const CSRF_TOKEN_KEY = 'csrf-token';
let csrfToken: string | null = null;

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Initialize CSRF token on login
 * Should be called after successful authentication
 */
export function initCSRFToken(): string {
  csrfToken = generateToken();
  // Store in sessionStorage (cleared on tab close) as backup
  sessionStorage.setItem(CSRF_TOKEN_KEY, csrfToken);
  return csrfToken;
}

/**
 * Get current CSRF token
 * Returns null if not initialized (user not logged in)
 */
export function getCSRFToken(): string | null {
  // Try memory first (primary)
  if (csrfToken) return csrfToken;
  
  // Fallback to sessionStorage (survives page refresh)
  const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
  if (stored) {
    csrfToken = stored;
    return csrfToken;
  }
  
  return null;
}

/**
 * Clear CSRF token on logout
 */
export function clearCSRFToken(): void {
  csrfToken = null;
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
}

/**
 * Validate CSRF token from request
 * Used on backend (GAS) to verify token matches
 */
export function validateCSRFToken(token: string): boolean {
  const currentToken = getCSRFToken();
  if (!currentToken) return false;
  
  // Constant-time comparison to prevent timing attacks
  if (token.length !== currentToken.length) return false;
  
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ currentToken.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Add CSRF token to request payload
 * Should be called before all state-changing requests (POST, PUT, DELETE)
 */
export function addCSRFToken<T extends Record<string, unknown>>(payload: T): T & { csrfToken: string } {
  const token = getCSRFToken();
  
  if (!token) {
    throw new Error('CSRF token not initialized. User must be logged in.');
  }
  
  return {
    ...payload,
    csrfToken: token,
  };
}

/**
 * Check if CSRF protection is active
 */
export function isCSRFProtected(): boolean {
  return csrfToken !== null;
}
