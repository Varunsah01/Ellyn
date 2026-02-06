import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

/**
 * Enhanced toast notifications with icons and styling
 */

export const showToast = {
  success: (message: string, options?: { duration?: number }) => {
    return toast.success(message, {
      duration: options?.duration || 3000,
      icon: '✓',
      style: {
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(142, 76%, 36%)',
      },
    });
  },

  error: (message: string, options?: { duration?: number; action?: () => void }) => {
    return toast.error(message, {
      duration: options?.duration || 5000,
      icon: '✗',
      style: {
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--destructive))',
      },
    });
  },

  warning: (message: string, options?: { duration?: number }) => {
    return toast(message, {
      duration: options?.duration || 4000,
      icon: '⚠',
      style: {
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(45, 93%, 47%)',
      },
    });
  },

  info: (message: string, options?: { duration?: number }) => {
    return toast(message, {
      duration: options?.duration || 4000,
      icon: 'ℹ',
      style: {
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--primary))',
      },
    });
  },

  loading: (message: string) => {
    return toast.loading(message, {
      style: {
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--border))',
      },
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
      }
    );
  },

  dismiss: (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },
};
