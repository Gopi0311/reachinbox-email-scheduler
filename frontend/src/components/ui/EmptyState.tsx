import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl bg-gradient-to-b from-white/[0.02] to-transparent border border-dashed border-white/[0.08] my-3">
      {/* Glow icon badge */}
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-indigo-500/20 to-violet-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/10">
          <Icon className="w-7 h-7" />
        </div>
      </div>
      <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
      <p className="mt-1.5 text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="gradient" className="mt-5" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

