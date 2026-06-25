import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 mb-4 rounded-sm glass-elevated flex items-center justify-center">
        <Icon size={22} className="text-ink-muted" />
      </div>
      <h3 className="font-display text-2xl text-ink mb-1.5">{title}</h3>
      <p className="font-body text-sm text-ink-muted max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}
