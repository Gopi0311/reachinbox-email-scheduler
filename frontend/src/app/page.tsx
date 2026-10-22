'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    api.auth
      .me()
      .then(() => {
        router.replace('/dashboard');
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#090A0F] text-slate-100">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
        <div className="relative">
          <Spinner size="lg" />
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold text-slate-400 tracking-wider uppercase">
        Initializing ReachInbox Scheduler...
      </p>
    </div>
  );
}

