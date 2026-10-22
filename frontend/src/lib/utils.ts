import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    const now = Date.now();
    const diffMs = d.getTime() - now;
    const diffSec = Math.round(diffMs / 1000);

    if (Math.abs(diffSec) < 60) {
      return diffSec > 0 ? `in ${diffSec}s` : `${Math.abs(diffSec)}s ago`;
    }

    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) {
      return diffMin > 0 ? `in ${diffMin}m` : `${Math.abs(diffMin)}m ago`;
    }

    const diffHours = Math.round(diffMin / 60);
    if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return diffDays > 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
  } catch {
    return '—';
  }
}

export function parseEmailList(input: string): string[] {
  if (!input) return [];
  // Matches any email-like token separated by commas, tabs, spaces, or newlines
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = input.match(emailRegex) || [];
  return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
}
