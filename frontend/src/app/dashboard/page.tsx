'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, EmailJob, SlackStatus, Stats } from '@/lib/types';
import { Header } from '@/components/Header';
import { StatsCards } from '@/components/StatsCards';
import { SlackConnectCard } from '@/components/SlackConnectCard';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { ComposeModal } from '@/components/ComposeModal';
import { ScheduledEmailsTable } from '@/components/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/SentEmailsTable';
import { SearchBar } from '@/components/SearchBar';
import { useToast } from '@/components/ui/Toast';
import { Plus, Clock, Send, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { error, success } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');

  // Stats & Slack status
  const [stats, setStats] = useState<Stats | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Scheduled table state
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledTotalPages, setScheduledTotalPages] = useState(1);
  const [isScheduledLoading, setIsScheduledLoading] = useState(true);
  const [scheduledError, setScheduledError] = useState<string | null>(null);

  // Sent table state
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotalPages, setSentTotalPages] = useState(1);
  const [isSentLoading, setIsSentLoading] = useState(true);
  const [sentError, setSentError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailJob[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Compose modal
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // 1. Fetch user authentication
  useEffect(() => {
    api.auth
      .me()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  // 2. Fetch stats and Slack status
  const fetchMetadata = useCallback(async () => {
    try {
      const [statsData, slackData] = await Promise.all([
        api.emails.getStats(),
        api.slack.getStatus(),
      ]);
      setStats(statsData);
      setSlackStatus(slackData);
    } catch {
      // ignore non-blocking
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // 3. Fetch scheduled emails
  const fetchScheduled = useCallback(async (page = 1) => {
    setIsScheduledLoading(true);
    setScheduledError(null);
    try {
      const res = await api.emails.getScheduled(page, 10);
      setScheduledEmails(res.items);
      setScheduledTotal(res.total);
      setScheduledPage(res.page);
      setScheduledTotalPages(res.totalPages);
    } catch (err: any) {
      setScheduledError(err.message || 'Failed to load scheduled emails');
    } finally {
      setIsScheduledLoading(false);
    }
  }, []);

  // 4. Fetch sent emails
  const fetchSent = useCallback(async (page = 1) => {
    setIsSentLoading(true);
    setSentError(null);
    try {
      const res = await api.emails.getSent(page, 10);
      setSentEmails(res.items);
      setSentTotal(res.total);
      setSentPage(res.page);
      setSentTotalPages(res.totalPages);
    } catch (err: any) {
      setSentError(err.message || 'Failed to load sent emails');
    } finally {
      setIsSentLoading(false);
    }
  }, []);

  // Initial load & Polling (every 5 seconds to observe live delayed job completion)
  useEffect(() => {
    fetchMetadata();
    fetchScheduled(1);
    fetchSent(1);

    const interval = setInterval(() => {
      fetchMetadata();
      if (!searchQuery) {
        fetchScheduled(scheduledPage);
        fetchSent(sentPage);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchMetadata, fetchScheduled, fetchSent, searchQuery, scheduledPage, sentPage]);

  // Handle Search
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      setIsSearching(true);
      try {
        const res = await api.emails.search(query.trim(), 1, 20);
        setSearchResults(res.items);
      } catch (err: any) {
        error(err.message || 'Search failed');
      } finally {
        setIsSearching(false);
      }
    },
    [error]
  );

  // Handle Cancel Email Job
  const handleCancel = async (id: string) => {
    try {
      await api.emails.cancel(id);
      success('Email job cancelled and removed from queue');
      fetchScheduled(scheduledPage);
      fetchMetadata();
    } catch (err: any) {
      error(err.message || 'Failed to cancel email job');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await api.auth.logout();
      router.push('/login');
    } catch (err: any) {
      error(err.message || 'Failed to logout');
      setIsLoggingOut(false);
    }
  };

  // Filter search results based on active tab with status normalization
  const filteredSearchResults = searchResults
    ? searchResults.filter((j) => {
        const s = (j.status || '').toLowerCase();
        return activeTab === 'scheduled'
          ? s === 'scheduled' || s === 'rescheduled' || s === 'processing'
          : s === 'sent' || s === 'failed';
      })
    : null;

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col">
      <Header user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Top Metric Cards */}
        <StatsCards stats={stats} isLoading={isStatsLoading} />

        {/* Slack OAuth Integration Banner */}
        <SlackConnectCard slackStatus={slackStatus} onRefresh={fetchMetadata} />

        {/* Action Bar (Tabs, Search, Refresh, Compose Button) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5">
          {/* Tabs */}
          <Tabs
            tabs={[
              {
                id: 'scheduled',
                label: 'Scheduled Queue',
                count: stats?.scheduledCount ?? scheduledTotal,
                icon: <Clock className="w-3.5 h-3.5" />,
              },
              {
                id: 'sent',
                label: 'Sent Emails',
                count: stats?.sentCount ?? sentTotal,
                icon: <Send className="w-3.5 h-3.5" />,
              },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as 'scheduled' | 'sent')}
          />

          {/* Search & Actions */}
          <div className="flex items-center space-x-2.5">
            <SearchBar onSearch={handleSearch} />

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchMetadata();
                fetchScheduled(scheduledPage);
                fetchSent(sentPage);
              }}
              className="p-2 h-auto"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-400 hover:text-white transition-colors" />
            </Button>

            <Button
              variant="gradient"
              onClick={() => setIsComposeOpen(true)}
              size="sm"
              className="whitespace-nowrap shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Compose Email
            </Button>
          </div>
        </div>

        {/* Search Results Notice if searching */}
        {searchQuery && (
          <div className="mb-4 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-2.5 rounded-xl flex items-center justify-between shadow-sm">
            <span>
              Showing Elasticsearch results for query: <strong className="text-white">&quot;{searchQuery}&quot;</strong>
            </span>
            <span className="font-bold tabular-nums bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
              {filteredSearchResults ? filteredSearchResults.length : 0} matches
            </span>
          </div>
        )}

        {/* Table View */}
        {activeTab === 'scheduled' ? (
          <ScheduledEmailsTable
            emails={filteredSearchResults !== null ? filteredSearchResults : scheduledEmails}
            total={filteredSearchResults !== null ? filteredSearchResults.length : scheduledTotal}
            page={scheduledPage}
            totalPages={filteredSearchResults !== null ? 1 : scheduledTotalPages}
            isLoading={isScheduledLoading || isSearching}
            error={scheduledError}
            onPageChange={(p) => fetchScheduled(p)}
            onCancel={handleCancel}
            onRefresh={() => fetchScheduled(scheduledPage)}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentEmailsTable
            emails={filteredSearchResults !== null ? filteredSearchResults : sentEmails}
            total={filteredSearchResults !== null ? filteredSearchResults.length : sentTotal}
            page={sentPage}
            totalPages={filteredSearchResults !== null ? 1 : sentTotalPages}
            isLoading={isSentLoading || isSearching}
            error={sentError}
            onPageChange={(p) => fetchSent(p)}
            onRefresh={() => fetchSent(sentPage)}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        )}
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          fetchMetadata();
          fetchScheduled(1);
        }}
      />
    </div>
  );
}

