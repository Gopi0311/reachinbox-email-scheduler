import { EmailJobStatus } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  googleId: string;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export interface ScheduleEmailsDto {
  subject: string;
  body: string;
  recipientEmails: string[];
  startTime?: string | Date;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  senderId?: string;
}

export interface EmailJobData {
  jobId: string; // The email_job DB record ID
  userId: string;
  senderId?: string;
  toEmail: string;
  subject: string;
  body: string;
  hourlyLimit: number;
  minDelayMs: number;
  scheduledTime: number; // timestamp
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
