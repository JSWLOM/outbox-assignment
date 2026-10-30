import { Queue } from 'bullmq';
import { redis } from './redis';

export const QUEUE_NAME = 'email-queue';
export interface EmailJob { emailId: string }

export const emailQueue = new Queue<EmailJob>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 5000 },
    removeOnFail: false,
  },
});

/**
 * jobId === email row id -> BullMQ ignores duplicate adds, so enqueueing is idempotent.
 */
export async function enqueueEmails(rows: { id: string; scheduled_at: Date | string }[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await emailQueue.addBulk(
      chunk.map((r) => ({
        name: 'send',
        data: { emailId: r.id },
        opts: { jobId: r.id, delay: Math.max(0, new Date(r.scheduled_at).getTime() - Date.now()) },
      })),
    );
  }
}
