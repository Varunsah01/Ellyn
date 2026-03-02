import toast from "react-hot-toast";

export type ToastType = "success" | "error" | "info" | "warning";

type ToastOptions = {
  duration?: number;
};

type PromiseMessages<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: unknown) => string);
};

type ShowToastFn = {
  (message: string, type?: ToastType, options?: ToastOptions): string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  loading: (message: string) => string;
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>) => Promise<T>;
  dismiss: (toastId?: string) => void;
};

function baseStyle(borderColor: string) {
  return {
    background: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    border: `1px solid ${borderColor}`,
  };
}

function emit(type: ToastType, message: string, options?: ToastOptions): string {
  const duration = options?.duration ?? (type === "error" ? 5000 : 3500);

  if (type === "success") {
    return toast.success(message, {
      duration,
      style: baseStyle("hsl(142, 76%, 36%)"),
    });
  }

  if (type === "error") {
    return toast.error(message, {
      duration,
      style: baseStyle("hsl(var(--destructive))"),
    });
  }

  if (type === "warning") {
    return toast(message, {
      duration,
      style: baseStyle("hsl(45, 93%, 47%)"),
    });
  }

  return toast(message, {
    duration,
    style: baseStyle("hsl(var(--primary))"),
  });
}

export const showToast = ((message: string, type: ToastType = "info", options?: ToastOptions) =>
  emit(type, message, options)) as ShowToastFn;

showToast.success = (message, options) => emit("success", message, options);
showToast.error = (message, options) => emit("error", message, options);
showToast.info = (message, options) => emit("info", message, options);
showToast.warning = (message, options) => emit("warning", message, options);

showToast.loading = (message: string) =>
  toast.loading(message, {
    style: baseStyle("hsl(var(--border))"),
  });

showToast.promise = <T>(promise: Promise<T>, messages: PromiseMessages<T>) =>
  toast.promise(
    promise,
    {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    },
    {
      style: baseStyle("hsl(var(--border))"),
    }
  );

showToast.dismiss = (toastId?: string) => {
  if (toastId) {
    toast.dismiss(toastId);
    return;
  }
  toast.dismiss();
};
