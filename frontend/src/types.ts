export interface User { id: string; email: string; name: string | null; avatar: string | null }

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';
export type MailboxKind = 'scheduled' | 'sent';

export interface EmailListItem {
  id: string;
  email: string;
  subject: string;
  status: EmailStatus;
  scheduled_at: string;
  sent_at: string | null;
  preview_url: string | null;
  error: string | null;
  snippet: string;
}

export interface EmailDetail extends Omit<EmailListItem, 'snippet'> {
  body: string;
  sender_email: string;
}

export interface Sender { id: number; email: string }
export interface Counts { scheduled: number; sent: number }
export interface SlackStatus { connected: boolean; channel?: string; team_name?: string }

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit?: number;
  senderId?: number;
}
export interface ScheduleResponse { batchId: string; count: number }
