export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  googleId: string;
}

export type EmailStatus =
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'rescheduled'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'RESCHEDULED';


export interface EmailJob {
  id: string;
  userId: string;
  senderId?: string | null;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  sentAt?: string | null;
  error?: string | null;
  attempts: number;
  messageId?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    email: string;
    name?: string | null;
    hourlyLimit: number;
    minDelayMs: number;
  } | null;
}

export interface SlackStatus {
  isConnected: boolean;
  teamName: string | null;
  channel: string | null;
  connectedAt: string | null;
}

export interface Stats {
  scheduledCount: number;
  sentCount: number;
  failedCount: number;
  currentHourSent: number;
  hourlyLimit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipientEmails: string[];
  startTime?: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}
