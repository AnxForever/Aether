import { X } from 'lucide-react';
import { useToastStore, type ToastType } from '../stores/toast';

const borderMap: Record<ToastType, string> = {
  info: 'border-cyan-500/50',
  error: 'border-red-500/50',
  success: 'border-green-500/50',
};

const iconMap: Record<ToastType, string> = {
  info: '●',
  error: '✕',
  success: '✓',
};

const colorMap: Record<ToastType, string> = {
  info: 'text-cyan-400',
  error: 'text-red-400',
  success: 'text-green-400',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto glass-elevated rounded-lg px-4 py-3 min-w-[280px] max-w-[380px] animate-slide-up border-l-2 ${borderMap[toast.type]} flex items-start gap-3`}
        >
          <span className={`mt-px text-sm font-bold ${colorMap[toast.type]}`}>
            {iconMap[toast.type]}
          </span>
          <p className="flex-1 text-sm text-ink leading-relaxed break-words">
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-ink-muted hover:text-ink transition-colors -mr-1 -mt-1 p-1 rounded hover:bg-white/5"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
