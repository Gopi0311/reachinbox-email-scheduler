'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Mail, CheckCircle2, ShieldCheck, Zap, Server, Database } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { error, success } = useToast();
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  const handleGoogleLogin = () => {
    // Redirect directly to the backend Google OAuth endpoint
    window.location.href = `${backendUrl}/auth/google`;
  };

  const handleDevLogin = async () => {
    try {
      setIsDevLoggingIn(true);
      await api.auth.devLogin('intern.evaluator@reachinbox.ai', 'ReachInbox Evaluator');
      success('Logged in as Evaluator!');
      router.push('/dashboard');
    } catch (err: any) {
      error(err.message || 'Dev login failed');
    } finally {
      setIsDevLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Soft Glow Ambient Accents */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-indigo-500/20 via-violet-500/10 to-transparent blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full rounded-3xl border border-white/[0.1] bg-[#0D0F18]/80 backdrop-blur-2xl shadow-2xl shadow-black/80 p-8 sm:p-9 text-center space-y-6 relative z-10 overflow-hidden">
        {/* Subtle top border highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

        {/* Brand Icon */}
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-2xl" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 border border-white/20">
            <Mail className="w-8 h-8" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            ReachInbox<span className="text-indigo-400">.ai</span>
          </h2>
          <p className="text-sm font-medium text-slate-300 mt-1.5">
            Production Full-Stack Email Job Scheduler
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Engineered with BullMQ, Redis, PostgreSQL, Elasticsearch, and Ethereal SMTP.
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3 pt-2">
          {/* Real Google OAuth Button */}
          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            size="lg"
            className="w-full flex items-center justify-center space-x-3 py-3 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.2] text-slate-100 shadow-sm"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="font-semibold text-slate-200">Sign in with Google</span>
          </Button>

          {/* Quick Dev/Evaluation Login */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
              <span className="bg-[#0D0F18] px-3 text-slate-500">
                Or evaluation mode
              </span>
            </div>
          </div>

          <Button
            onClick={handleDevLogin}
            variant="gradient"
            size="lg"
            isLoading={isDevLoggingIn}
            className="w-full py-3 shadow-lg shadow-indigo-500/25"
          >
            <Zap className="w-4 h-4 mr-2" />
            One-Click Evaluator Sign-In
          </Button>
        </div>

        {/* Feature Highlights */}
        <div className="pt-4 border-t border-white/[0.08] text-left space-y-2 text-xs text-slate-400">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>BullMQ delayed jobs (Zero cron / crontab)</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Strict DB idempotency & conditional claiming</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Server className="w-4 h-4 text-violet-400 shrink-0" />
            <span>Redis sliding window rate limiting & Slack alerts</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Database className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Durable recovery from crashes and server restarts</span>
          </div>
        </div>
      </div>
    </div>
  );
}

