/**
 * Centralized Error Handler
 * 
 * Classifies errors, provides user-friendly messages, and handles logging.
 */

// ============================================
// Error Types
// ============================================

export class NetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ServerError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ServerError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================
// Error Classification
// ============================================

export type ErrorType = 
  | 'network'
  | 'validation'
  | 'auth'
  | 'server'
  | 'timeout'
  | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  userMessage: string;
  canRetry: boolean;
  originalError?: unknown;
  details?: Record<string, unknown>;
}

/**
 * Classify an error into a specific type with user-friendly message
 */
export function classifyError(error: unknown): ClassifiedError {
  // Network errors
  if (error instanceof NetworkError) {
    return {
      type: 'network',
      message: error.message,
      userMessage: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
      canRetry: true,
      originalError: error.originalError,
    };
  }

  // Validation errors
  if (error instanceof ValidationError) {
    return {
      type: 'validation',
      message: error.message,
      userMessage: error.message,
      canRetry: false,
      details: error.fields,
    };
  }

  // Auth errors
  if (error instanceof AuthError) {
    return {
      type: 'auth',
      message: error.message,
      userMessage: 'Sesi Anda telah berakhir. Silakan login kembali.',
      canRetry: false,
      details: { code: error.code },
    };
  }

  // Server errors
  if (error instanceof ServerError) {
    return {
      type: 'server',
      message: error.message,
      userMessage: 'Terjadi kesalahan di server. Silakan coba lagi nanti.',
      canRetry: true,
      details: { statusCode: error.statusCode },
    };
  }

  // Timeout errors
  if (error instanceof TimeoutError) {
    return {
      type: 'timeout',
      message: error.message,
      userMessage: 'Permintaan memakan waktu terlalu lama. Silakan coba lagi.',
      canRetry: true,
    };
  }

  // Standard Error objects
  if (error instanceof Error) {
    // Check for specific error messages
    const msg = error.message.toLowerCase();
    
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return {
        type: 'network',
        message: error.message,
        userMessage: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
        canRetry: true,
        originalError: error,
      };
    }
    
    if (msg.includes('timeout')) {
      return {
        type: 'timeout',
        message: error.message,
        userMessage: 'Permintaan memakan waktu terlalu lama. Silakan coba lagi.',
        canRetry: true,
        originalError: error,
      };
    }
    
    if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('token')) {
      return {
        type: 'auth',
        message: error.message,
        userMessage: 'Sesi Anda telah berakhir. Silakan login kembali.',
        canRetry: false,
        originalError: error,
      };
    }
    
    if (msg.includes('validation') || msg.includes('invalid')) {
      return {
        type: 'validation',
        message: error.message,
        userMessage: error.message,
        canRetry: false,
        originalError: error,
      };
    }
    
    // Generic error
    return {
      type: 'unknown',
      message: error.message,
      userMessage: 'Terjadi kesalahan. Silakan coba lagi.',
      canRetry: true,
      originalError: error,
    };
  }

  // Unknown error type
  return {
    type: 'unknown',
    message: String(error),
    userMessage: 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.',
    canRetry: true,
    originalError: error,
  };
}

// ============================================
// Error Handling
// ============================================

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  logToMonitoring?: boolean;
  onRetry?: () => void;
}

/**
 * Handle an error with classification and optional actions
 */
export function handleError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): ClassifiedError {
  const {
    showToast = false,
    logToConsole = true,
    logToMonitoring = false,
  } = options;

  const classified = classifyError(error);

  // Log to console in development
  if (logToConsole && import.meta.env.DEV) {
    console.error(`[${classified.type.toUpperCase()}]`, classified.message);
    if (classified.originalError) {
      console.error('Original error:', classified.originalError);
    }
  }

  // Log to monitoring service in production
  if (logToMonitoring && !import.meta.env.DEV) {
    // TODO: Integrate with Sentry or similar
    // Sentry.captureException(classified.originalError || error);
  }

  // Show toast notification
  if (showToast) {
    // Import dynamically to avoid circular dependency
    import('sonner').then(({ toast }) => {
      if (classified.type === 'validation') {
        toast.error(classified.userMessage);
      } else if (classified.canRetry) {
        toast.error(classified.userMessage, {
          action: options.onRetry ? {
            label: 'Coba Lagi',
            onClick: options.onRetry,
          } : undefined,
        });
      } else {
        toast.error(classified.userMessage);
      }
    });
  }

  return classified;
}

// ============================================
// API Error Helpers
// ============================================

/**
 * Handle API response errors
 */
export function handleAPIError(response: Response): never {
  if (response.status === 401 || response.status === 403) {
    throw new AuthError('Unauthorized', String(response.status));
  }
  
  if (response.status === 400) {
    throw new ValidationError('Invalid request data');
  }
  
  if (response.status >= 500) {
    throw new ServerError('Server error', response.status);
  }
  
  if (response.status === 408 || response.status === 504) {
    throw new TimeoutError('Request timeout');
  }
  
  throw new ServerError(`HTTP ${response.status}`, response.status);
}

/**
 * Handle fetch errors
 */
export function handleFetchError(error: unknown): never {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    throw new NetworkError('Network request failed', error);
  }
  
  if (error instanceof Error && error.name === 'AbortError') {
    throw new TimeoutError('Request was aborted');
  }
  
  throw error;
}

// ============================================
// Retry Logic
// ============================================

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: boolean;
  onRetry?: (attempt: number) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const classified = classifyError(error);
      
      // Don't retry if error is not retryable
      if (!classified.canRetry) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
      
      // Notify retry callback
      if (onRetry) {
        onRetry(attempt);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// Error Boundary Helpers
// ============================================

export interface ErrorInfo {
  componentStack: string;
}

/**
 * Log error from React Error Boundary
 */
export function logErrorBoundary(error: Error, errorInfo: ErrorInfo): void {
  console.error('React Error Boundary caught an error:', error);
  console.error('Component stack:', errorInfo.componentStack);
  
  // Log to monitoring in production
  if (!import.meta.env.DEV) {
    // TODO: Integrate with Sentry
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //   },
    // });
  }
}
