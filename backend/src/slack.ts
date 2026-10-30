import { pool } from './db';
import { redis } from './redis';

/**
 * Posts to the user's connected Slack webhook. No connection -> silently skipped.
 * Deduped to one message per user+sender+hour window so a 1000-email burst doesn't spam.
 */
export async function notifyRateLimit(userId: string, senderEmail: string, senderId: number, window: number, limit: number, resumeAt: number) {
  try {
    const { rows } = await pool.query('SELECT webhook_url FROM slack_connections WHERE user_id=$1', [userId]);
    if (!rows[0]) return;
    const first = await redis.set(`slacknotif:${userId}:${senderId}:${window}`, '1', 'EX', 3600, 'NX');
    if (!first) return;
    const res = await fetch(rows[0].webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:warning: Hourly limit (${limit}) reached for sender *${senderEmail}*. Remaining emails are rescheduled to ${new Date(resumeAt).toISOString()}.`,
      }),
    });
    if (!res.ok) console.error('[slack] webhook responded', res.status);
  } catch (e) {
    console.error('[slack] notify failed', (e as Error).message);
  }
}
