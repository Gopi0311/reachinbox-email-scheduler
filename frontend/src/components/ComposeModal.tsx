'use client';

import React, { useState, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { parseEmailList } from '@/lib/utils';
import { useToast } from './ui/Toast';
import { api } from '@/lib/api';
import {
  UploadCloud,
  Users,
  Calendar,
  Clock,
  Gauge,
  FileText,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rawRecipients, setRawRecipients] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delaySec, setDelaySec] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const detectedEmails = parseEmailList(rawRecipients);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawRecipients((prev) => (prev ? `${prev}\n${content}` : content));
      }
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleLoadSampleRecipients = (count: number) => {
    const samples: string[] = [];
    for (let i = 1; i <= count; i++) {
      samples.push(`lead${i}@reachinbox-sample.com`);
    }
    setRawRecipients((prev) => (prev ? `${prev}\n${samples.join('\n')}` : samples.join('\n')));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      error('Please provide an email subject');
      return;
    }

    if (!body.trim()) {
      error('Please write an email body');
      return;
    }

    if (detectedEmails.length === 0) {
      error('Please provide at least one valid recipient email address');
      return;
    }

    try {
      setIsSubmitting(true);

      const delayMs = Math.max(0, parseFloat(delaySec) * 1000);
      const limit = parseInt(hourlyLimit, 10) || 100;
      const scheduledIso = startTime ? new Date(startTime).toISOString() : undefined;

      const res = await api.emails.schedule({
        subject: subject.trim(),
        body: body.trim(),
        recipientEmails: detectedEmails,
        startTime: scheduledIso,
        delayBetweenEmailsMs: delayMs,
        hourlyLimit: limit,
      });

      success(`Scheduled ${res.scheduledCount} emails into BullMQ queue!`);
      // Reset form
      setSubject('');
      setBody('');
      setRawRecipients('');
      setStartTime('');
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Email Campaign"
      description="Queue batch emails with durable BullMQ delayed jobs and rate-limited dispatch"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Campaign Content */}
        <div className="space-y-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
            <FileText className="w-4 h-4" />
            <span>Step 1: Campaign Content</span>
          </div>

          <Input
            label="Subject Line"
            placeholder="e.g. Introducing our new automated scheduling engine"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Email Body (HTML / Plain Text)
            </label>
            <textarea
              rows={4}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/[0.08] bg-[#0E121E] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/40 transition-all duration-200"
              placeholder="Write your email body or template here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Step 2: Target Audience & CSV Upload */}
        <div className="space-y-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <Users className="w-4 h-4" />
              <span>Step 2: Target Audience</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 tabular-nums">
                <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                <span>
                  {detectedEmails.length} {detectedEmails.length === 1 ? 'email' : 'emails'} detected
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleLoadSampleRecipients(10)}
                className="text-[11px] font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
              >
                +10 Sample
              </button>
              <button
                type="button"
                onClick={() => handleLoadSampleRecipients(100)}
                className="text-[11px] font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
              >
                +100 Sample
              </button>
            </div>
          </div>

          {/* Drag & Drop Upload Dropzone */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".csv,.txt"
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
              isDragging
                ? 'border-indigo-400 bg-indigo-500/10 scale-[0.99]'
                : 'border-white/[0.1] hover:border-indigo-500/40 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-200">
              Drag & drop CSV or TXT file here, or <span className="text-indigo-400 underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Automatically parses and deduplicates email addresses
            </p>
          </div>

          {/* Manual input textarea */}
          <div className="space-y-1">
            <textarea
              rows={2}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0E121E] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/40 font-mono transition-all duration-200"
              placeholder="Or paste comma/newline separated recipient emails here..."
              value={rawRecipients}
              onChange={(e) => setRawRecipients(e.target.value)}
            />
          </div>
        </div>

        {/* Step 3: Dispatch & Rate Limits */}
        <div className="space-y-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
            <Clock className="w-4 h-4" />
            <span>Step 3: Dispatch Rules & Rate Limiting</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Scheduled Start Time
              </label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0E121E] text-slate-100 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/40 transition-all"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <p className="text-[10px] text-slate-500">Leave blank to queue immediately</p>
            </div>

            {/* Delay Between Emails */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Delay Between Sends (Sec)
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={delaySec}
                onChange={(e) => setDelaySec(e.target.value)}
                required
              />
              <p className="text-[10px] text-slate-500">Enforced per sender email</p>
            </div>

            {/* Hourly Limit */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Hourly Limit Window
              </label>
              <Input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                required
              />
              <p className="text-[10px] text-slate-500">Auto-reschedules if exceeded</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/[0.08]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gradient"
            isLoading={isSubmitting}
            disabled={detectedEmails.length === 0}
            className="shadow-lg shadow-indigo-500/25"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Schedule {detectedEmails.length} {detectedEmails.length === 1 ? 'Email' : 'Emails'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

