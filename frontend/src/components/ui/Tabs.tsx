import React from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div
      className={cn(
        'inline-flex p-1 bg-white/[0.03] backdrop-blur-md rounded-xl space-x-1 border border-white/[0.08]',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200',
              isActive
                ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.1]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
            )}
          >
            {tab.icon && <span className={cn('w-3.5 h-3.5', isActive ? 'text-indigo-400' : 'text-slate-400')}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'px-2 py-0.5 text-[11px] font-bold rounded-full tabular-nums',
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-white/[0.06] text-slate-400 border border-white/[0.05]'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
