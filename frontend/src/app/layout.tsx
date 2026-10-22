import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ReachInbox.ai | Full-Stack Email Job Scheduler',
  description: 'Production-oriented Email Job Scheduler with BullMQ, Redis, PostgreSQL, and Elasticsearch',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-[#090A0F] text-slate-100 font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-x-hidden">
        {/* Subtle radial glow accents */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-indigo-500/10 via-violet-500/5 to-transparent blur-[120px] rounded-full" />
          <div className="absolute top-1/3 -left-48 w-[500px] h-[500px] bg-indigo-600/5 blur-[140px] rounded-full" />
          <div className="absolute top-2/3 -right-48 w-[500px] h-[500px] bg-violet-600/5 blur-[140px] rounded-full" />
        </div>
        <ToastProvider>
          <div className="relative z-10 flex min-h-screen flex-col">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}

