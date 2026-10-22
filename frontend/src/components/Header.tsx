'use client';

import React from 'react';
import { User } from '@/lib/types';
import { LogOut, Activity, Mail } from 'lucide-react';
import { Button } from './ui/Button';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  isLoggingOut?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, isLoggingOut }) => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  return (
    <header className="sticky top-0 z-30 bg-[#090A0F]/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3.5">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/30 blur-md rounded-xl" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/20">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                ReachInbox<span className="text-indigo-400">.ai</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Scheduler
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Distributed BullMQ & Redis Engine
            </p>
          </div>
        </div>

        {/* User profile & Actions */}
        <div className="flex items-center space-x-3">
          {/* Bull Board Quick Link */}
          <a
            href={`${backendUrl}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all border border-white/[0.08] hover:border-white/[0.15]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Bull Board</span>
          </a>

          {user && (
            <div className="flex items-center space-x-3 pl-2 border-l border-white/[0.08]">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name || user.email}
                  className="w-8 h-8 rounded-full ring-2 ring-indigo-500/30 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center text-xs shadow-md shadow-indigo-500/20">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">
                  {user.name || 'User'}
                </p>
                <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                  {user.email}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                isLoading={isLoggingOut}
                className="text-slate-400 hover:text-rose-400 p-2 rounded-xl"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

