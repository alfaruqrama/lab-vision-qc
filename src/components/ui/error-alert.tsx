import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ClassifiedError } from '@/lib/error-handler';

interface ErrorAlertProps {
  error: ClassifiedError | Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Error Alert Component
 * 
 * Displays user-friendly error messages with appropriate styling and actions.
 */
export function ErrorAlert({ error, onRetry, onDismiss, className }: ErrorAlertProps) {
  // Convert to ClassifiedError if needed
  let classified: ClassifiedError;
  
  if (typeof error === 'string') {
    classified = {
      type: 'unknown',
      message: error,
      userMessage: error,
      canRetry: false,
    };
  } else if ('type' in error) {
    classified = error as ClassifiedError;
  } else {
    classified = {
      type: 'unknown',
      message: error.message,
      userMessage: error.message,
      canRetry: false,
    };
  }

  // Determine icon and variant based on error type
  const getIcon = () => {
    switch (classified.type) {
      case 'validation':
        return <AlertCircle className="h-4 w-4" />;
      case 'auth':
        return <XCircle className="h-4 w-4" />;
      case 'network':
      case 'timeout':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = (): 'default' | 'destructive' => {
    switch (classified.type) {
      case 'validation':
      case 'auth':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getTitle = () => {
    switch (classified.type) {
      case 'network':
        return 'Masalah Koneksi';
      case 'validation':
        return 'Data Tidak Valid';
      case 'auth':
        return 'Autentikasi Gagal';
      case 'server':
        return 'Kesalahan Server';
      case 'timeout':
        return 'Waktu Habis';
      default:
        return 'Terjadi Kesalahan';
    }
  };

  return (
    <Alert variant={getVariant()} className={className}>
      {getIcon()}
      <AlertTitle>{getTitle()}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{classified.userMessage}</p>
        
        {import.meta.env.DEV && classified.message !== classified.userMessage && (
          <p className="text-xs font-mono opacity-70">
            Debug: {classified.message}
          </p>
        )}
        
        <div className="flex gap-2 mt-3">
          {classified.canRetry && onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
            >
              Coba Lagi
            </Button>
          )}
          
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
            >
              Tutup
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline error message (smaller, for forms)
 */
interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <p className={`text-sm text-destructive flex items-center gap-1 ${className || ''}`}>
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
}
