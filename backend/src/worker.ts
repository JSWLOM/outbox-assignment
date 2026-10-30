import { Worker, DelayedError } from 'bullmq';
import { config } from './config';
import { pool, migrate } from './db';
import { redis } from './redis';
import { QUEUE_NAME, EmailJob } from './queue';
import { acquireSlot } from './rateLimiter';
import { notifyRateLimit } from './slack';
import { sendEmail, ensureSenders } from './mailer';
import { ensureIndex, updateEmailDoc } from './search';
import { reconcile } from './reconcile';

async function main() {
  await migrate();
  await ensureSenders();
  await ensureIndex();
  await reconcile();

  const worker = new Worker<EmailJob>(
    QUEUE_NAME,
    async (job, token) => {
      const { rows } = await pool.query(
        'SELECT e.*, s.email AS sender_email FROM emails e JOIN senders s ON s.id = e.sender_id WHERE e.id=$1',
        [job.data.emailId],
      );
      const email = rows[0];
      // Idempotency: never process an email that's already terminal.
      if (!email || email.status === 'sent' || email.status === 'failed') return;

      // Hourly rate limit (per sender, Redis-backed, shared by all workers)
      const limit = email.hourly_limit ?? config.maxEmailsPerHourPerSender;
      const slot = await acquireSlot(email.sender_id, limit);
      if (!slot.allowed) {
        const resumeAt = slot.nextWindowAt + Math.min(email.seq, 10_000) * 5; // small stagger keeps original order
        await notifyRateLimit(email.user_id, email.sender_email, email.sender_id, slot.window, limit, resumeAt);
        await pool.query('UPDATE emails SET scheduled_at=$2 WHERE id=$1', [email.id, new Date(resumeAt)]);
        await updateEmailDoc(email.id, { scheduled_at: new Date(resumeAt) });
        await job.moveToDelayed(resumeAt, token);
        throw new DelayedError();
      }

      await pool.query("UPDATE emails SET status='processing', attempts=attempts+1 WHERE id=$1", [email.id]);
      const info = await sendEmail(email.sender_id, email.recipient, email.subject, email.body);
      const sentAt = new Date();
      await pool.query(
        "UPDATE emails SET status='sent', sent_at=$2, message_id=$3, preview_url=$4, error=NULL WHERE id=$1",
        [email.id, sentAt, info.messageId, info.previewUrl],
      );
      await updateEmailDoc(email.id, { status: 'sent', sent_at: sentAt });
    },
    {
      connection: redis,
      concurrency: config.worker.concurrency,
      // Global throttle across all workers: max 1 job per MIN_DELAY_BETWEEN_EMAILS_MS
      limiter: { max: 1, duration: config.worker.minDelayMs },
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (final) {
      await pool.query("UPDATE emails SET status='failed', error=$2 WHERE id=$1 AND status<>'sent'", [job.data.emailId, err.message]);
      await updateEmailDoc(job.data.emailId, { status: 'failed' });
    }
  });
  worker.on('error', (e) => console.error('[worker] error', e.message));

  console.log(`[worker] up | concurrency=${config.worker.concurrency} minDelay=${config.worker.minDelayMs}ms hourlyLimit=${config.maxEmailsPerHourPerSender}/sender`);

  const shutdown = async () => { await worker.close(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
