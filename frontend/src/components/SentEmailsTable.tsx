'use client';

import React from 'react';
import { EmailJob } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { TableSkeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';
import { Send, ExternalLink, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

interface SentEmailsTableProps {
  emails: EmailJob[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onPageChange: (newPage: number) => void;
  onRefresh: () => void;
  onComposeClick: () => void;
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
  emails,
  total,
  page,
  totalPages,
  isLoading,
  error,
  onPageChange,
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
        <h4 className="text-base font-bold text-white">Failed to load sent emails</h4>
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
          icon={Send}
          title="No emails sent yet"
          description="Emails delivered by the BullMQ worker will appear here with delivery timestamps and Ethereal preview URLs."
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
              <th className="py-3.5 px-4">Sent At</th>
              <th className="py-3.5 px-4">Delivery Status</th>
              <th className="py-3.5 px-4 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {emails.map((job) => {
              // Task 1: Normalize status to lowercase to handle Prisma enum ("SENT", "FAILED", etc.)
              const rawStatus = (job.status || '').toLowerCase();
              const isSent = rawStatus === 'sent';
              const isFailed = rawStatus === 'failed';
              const isPending =
                rawStatus === 'scheduled' ||
                rawStatus === 'processing' ||
                rawStatus === 'rescheduled';

              const previewUrl = job.previewUrl || (job as any).preview_url;

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

                  {/* Sent At */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 tabular-nums">
                    {formatDate(job.sentAt || job.updatedAt)}
                  </td>

                  {/* Delivery Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {isSent ? (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Sent (250 OK)</span>
                      </span>
                    ) : isFailed ? (
                      <span
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20 shadow-sm shadow-rose-500/10 cursor-help"
                        title={job.error || 'Delivery failed'}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>Failed</span>
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm shadow-amber-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>
                          {rawStatus === 'processing'
                            ? 'Processing'
                            : rawStatus === 'rescheduled'
                            ? 'Rescheduled'
                            : 'Scheduled'}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.05] text-slate-400 border border-white/[0.08]">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>{job.status}</span>
                      </span>
                    )}
                  </td>

                  {/* Ethereal Preview URL */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    {previewUrl ? (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 transition-all shadow-sm shadow-indigo-500/10"
                        title="Open Ethereal test email in browser"
                      >
                        <span>View Email</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No preview URL</span>
                    )}
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
          ({total} total records)
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

