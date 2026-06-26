"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({
  message,
  visible,
  onDismiss,
  durationMs = 3000,
}: ToastProps) {
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition-opacity"
    >
      {message}
    </div>
  );
}
