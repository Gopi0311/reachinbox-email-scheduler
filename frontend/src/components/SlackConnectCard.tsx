'use client';

import React, { useState } from 'react';
import { SlackStatus } from '@/lib/types';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { api } from '@/lib/api';
import { Bell, CheckCircle2, AlertCircle, Send, Unlink, ExternalLink } from 'lucide-react';

interface SlackConnectCardProps {
  slackStatus: SlackStatus | null;
  onRefresh: () => void;
}

export const SlackConnectCard: React.FC<SlackConnectCardProps> = ({ slackStatus, onRefresh }) => {
  const { success, error, info } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const isConnected = slackStatus?.isConnected ?? false;

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const res = await api.slack.connect();
      if (res.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err: any) {
      error(err.message || 'Failed to start Slack OAuth');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await api.slack.disconnect();
      success('Slack integration disconnected');
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to disconnect Slack');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setIsTesting(true);
      const res = await api.slack.test();
      if (res.sent) {
        success('Test alert delivered to Slack!');
      } else {
        info(res.message || 'Check Slack permissions / webhook URL');
      }
    } catch (err: any) {
      error(err.message || 'Failed to trigger Slack test alert');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0E111B]/60 backdrop-blur-md p-5 shadow-xl shadow-black/20 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-start space-x-4">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
              : 'bg-white/[0.04] border-white/[0.08] text-slate-400'
          }`}
        >
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2.5">
            <h4 className="text-sm font-bold text-white tracking-tight">
              Slack Rate Limit Alerts
            </h4>
            {isConnected ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.05] text-slate-400 border border-white/[0.08]">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Not Connected</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
            {isConnected
              ? `Real-time alerts are routed to ${slackStatus?.teamName || 'your Slack workspace'}${
                  slackStatus?.channel ? ` in #${slackStatus.channel}` : ''
                } whenever the hourly limit is reached.`
              : 'Connect Slack OAuth to automatically receive alerts in your workspace when sender hourly limits are hit.'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5 w-full md:w-auto justify-end">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNotification}
              isLoading={isTesting}
              className="text-xs"
            >
              <Send className="w-3 h-3 mr-1 text-slate-400" /> Test Alert
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDisconnect}
              isLoading={isDisconnecting}
              className="text-xs"
            >
              <Unlink className="w-3 h-3 mr-1" /> Disconnect
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            isLoading={isConnecting}
            className="text-xs bg-[#4A154B] hover:bg-[#3D113E] text-white border border-[#611f64]/50 shadow-lg shadow-[#4A154B]/20"
          >
            <ExternalLink className="w-3 h-3 mr-1.5" /> Connect Slack
          </Button>
        )}
      </div>
    </div>
  );
};

