'use client';

import React from 'react';
import { EmailJob } from '@/lib/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { TableSkeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';
import { Clock, Trash2, Calendar, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

interface ScheduledEmailsTableProps {
  emails: EmailJob[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onPageChange: (newPage: number) => void;
  onCancel: (id: string) => void;
  onRefresh: () => void;
  onComposeClick: () => void;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
  emails,
  total,
  page,
  totalPages,
  isLoading,
  error,
  onPageChange,
  onCancel,
  onRefresh,
  onComposeClick,
}) => {
  if (isLoading && emails.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md shadow-xl overflow-hidden">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] backdrop-blur-md p-8 text-center shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-white">Failed to load scheduled emails</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{error}</p>
        <Button onClick={onRefresh} variant="outline" size="sm" className="mt-4">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
        </Button>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md shadow-xl overflow-hidden">
        <EmptyState
          icon={Calendar}
          title="No scheduled emails queued"
          description="You don't have any delayed emails waiting in the BullMQ queue right now."
          actionLabel="Compose New Email"
          onAction={onComposeClick}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md shadow-2xl shadow-black/30 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="sticky top-0 bg-[#0E111B]/95 backdrop-blur-md z-10 border-b border-white/[0.08] text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
              <th className="py-3.5 px-4">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Scheduled For</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {emails.map((job) => {
              const rawStatus = (job.status || '').toLowerCase();
              const isRescheduled = rawStatus === 'rescheduled';
              const isProcessing = rawStatus === 'processing';

              return (
                <tr
                  key={job.id}
                  className="hover:bg-white/[0.03] transition-colors"
                >
                  {/* Recipient */}
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                    {job.toEmail}
                  </td>

                  {/* Subject */}
                  <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate font-medium">
                    {job.subject}
                  </td>

                  {/* Scheduled For */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 tabular-nums">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{formatDate(job.scheduledAt)}</span>
                      <span className="text-[10px] text-slate-500">
                        ({formatRelativeTime(job.scheduledAt)})
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {isProcessing ? (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 shadow-sm shadow-blue-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span>Processing</span>
                      </span>
                    ) : isRescheduled ? (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm shadow-amber-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>Rate Limited</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-sm shadow-indigo-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span>Queued</span>
                      </span>
                    )}
                  </td>

                  {/* Action: Cancel */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onCancel(job.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
                      title="Cancel and remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-white/[0.01] text-xs text-slate-400">
        <div>
          Showing page <span className="font-semibold text-slate-200 tabular-nums">{page}</span> of{' '}
          <span className="font-semibold text-slate-200 tabular-nums">{totalPages || 1}</span>{' '}
          ({total} total jobs)
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 h-auto"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 h-auto"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

