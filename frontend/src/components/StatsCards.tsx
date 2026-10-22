import React from 'react';
import { Stats } from '@/lib/types';
import { Clock, Send, AlertTriangle, Gauge, TrendingUp, CheckCircle, ShieldAlert } from 'lucide-react';

export const StatsCards: React.FC<{ stats: Stats | null; isLoading: boolean }> = ({
  stats,
  isLoading,
}) => {
  const scheduled = stats?.scheduledCount ?? 0;
  const sent = stats?.sentCount ?? 0;
  const failed = stats?.failedCount ?? 0;
  const currentHour = stats?.currentHourSent ?? 0;
  const hourlyLimit = stats?.hourlyLimit ?? 100;
  const percentUsed = Math.min(100, Math.round((currentHour / hourlyLimit) * 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Scheduled Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md p-5 hover:border-white/[0.16] transition-all duration-300 shadow-xl shadow-black/20 group flex flex-col justify-between">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Scheduled Queue
            </p>
            <p className="text-3xl font-extrabold text-white mt-1.5 tracking-tight tabular-nums">
              {isLoading ? (
                <span className="inline-block w-12 h-7 bg-white/[0.06] rounded-md animate-pulse" />
              ) : (
                scheduled.toLocaleString()
              )}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10 group-hover:scale-105 transition-transform duration-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center space-x-1 text-amber-400/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>BullMQ Delayed Queue</span>
          </span>
          <span className="text-slate-500">Persistent</span>
        </div>
      </div>

      {/* 2. Sent Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md p-5 hover:border-white/[0.16] transition-all duration-300 shadow-xl shadow-black/20 group flex flex-col justify-between">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Delivered Successfully
            </p>
            <p className="text-3xl font-extrabold text-white mt-1.5 tracking-tight tabular-nums">
              {isLoading ? (
                <span className="inline-block w-12 h-7 bg-white/[0.06] rounded-md animate-pulse" />
              ) : (
                sent.toLocaleString()
              )}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform duration-300">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Ethereal SMTP 250 OK</span>
          </span>
          <span className="text-slate-500">Realtime</span>
        </div>
      </div>

      {/* 3. Failed Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md p-5 hover:border-white/[0.16] transition-all duration-300 shadow-xl shadow-black/20 group flex flex-col justify-between">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Failed Deliveries
            </p>
            <p className="text-3xl font-extrabold text-white mt-1.5 tracking-tight tabular-nums">
              {isLoading ? (
                <span className="inline-block w-12 h-7 bg-white/[0.06] rounded-md animate-pulse" />
              ) : (
                failed.toLocaleString()
              )}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/10 group-hover:scale-105 transition-transform duration-300">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center space-x-1 text-rose-400/90 font-medium">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Idempotency Recorded</span>
          </span>
          <span className="text-slate-500">{failed === 0 ? 'Optimal' : 'Investigate'}</span>
        </div>
      </div>

      {/* 4. Hourly Rate Limit Window */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md p-5 hover:border-white/[0.16] transition-all duration-300 shadow-xl shadow-black/20 group flex flex-col justify-between">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Hourly Limit Usage
            </p>
            <p className="text-3xl font-extrabold text-white mt-1.5 tracking-tight tabular-nums flex items-baseline gap-1">
              {isLoading ? (
                <span className="inline-block w-16 h-7 bg-white/[0.06] rounded-md animate-pulse" />
              ) : (
                <>
                  <span>{currentHour}</span>
                  <span className="text-base font-normal text-slate-500">/ {hourlyLimit}</span>
                </>
              )}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10 group-hover:scale-105 transition-transform duration-300">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        {/* Smooth Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1.5">
            <span>Window Utilization</span>
            <span className="font-semibold tabular-nums text-slate-200">{percentUsed}%</span>
          </div>
          <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden p-[1px] border border-white/[0.05]">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                percentUsed >= 90
                  ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-sm shadow-rose-500/50'
                  : percentUsed >= 70
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm shadow-amber-500/50'
                  : 'bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500 shadow-sm shadow-indigo-500/50'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

