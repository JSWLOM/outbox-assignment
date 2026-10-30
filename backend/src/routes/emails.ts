import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from './auth';
import { enqueueEmails } from '../queue';
import { indexEmails, searchEmailIds } from '../search';

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

const SCHEDULED = ['scheduled', 'processing'];
const SENT = ['sent', 'failed'];

const LIST_COLS = `id, recipient AS email, subject, status, scheduled_at, sent_at, preview_url, error,
  left(btrim(regexp_replace(body, '<[^>]+>', ' ', 'g')), 160) AS snippet`;

const scheduleSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(50_000),
  startTime: z.string().datetime(),                 // ISO string
  delayBetweenMs: z.number().int().min(0).default(2000),
  hourlyLimit: z.number().int().min(1).optional(),  // falls back to MAX_EMAILS_PER_HOUR_PER_SENDER
  senderId: z.number().int().optional(),            // pin a sender; omitted = round-robin
});

emailsRouter.post('/schedule', async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { subject, body, startTime, delayBetweenMs, hourlyLimit, senderId } = parsed.data;
  const recipients = [...new Set(parsed.data.recipients.map((r) => r.trim().toLowerCase()))];

  const { rows: senders } = await pool.query('SELECT id FROM senders ORDER BY id');
  if (!senders.length) return res.status(500).json({ error: 'No senders configured' });
  if (senderId && !senders.some((s) => s.id === senderId)) return res.status(400).json({ error: 'Unknown sender' });

  const start = Math.max(new Date(startTime).getTime(), Date.now());
  const sendAts = recipients.map((_, i) => new Date(start + i * delayBetweenMs));
  const senderIds = recipients.map((_, i) => senderId ?? senders[i % senders.length].id); // round-robin unless pinned
  const batchId = randomUUID();

  const { rows } = await pool.query(
    `INSERT INTO emails (user_id, batch_id, sender_id, recipient, subject, body, scheduled_at, seq, hourly_limit)
     SELECT $1, $2, t.sender_id, t.recipient, $3, $4, t.scheduled_at, t.seq, $5
     FROM unnest($6::text[], $7::int[], $8::timestamptz[], $9::int[]) AS t(recipient, sender_id, scheduled_at, seq)
     RETURNING *`,
    [req.userId, batchId, subject, body, hourlyLimit ?? null, recipients, senderIds, sendAts, recipients.map((_, i) => i)],
  );

  await enqueueEmails(rows);   // BullMQ delayed jobs, jobId = email id
  await indexEmails(rows);     // Elasticsearch
  res.status(201).json({ batchId, count: rows.length });
});

const list = (statuses: string[], order: string) => async (req: any, res: any) => {
  const { rows } = await pool.query(
    `SELECT ${LIST_COLS} FROM emails WHERE user_id=$1 AND status = ANY($2) ORDER BY ${order} LIMIT 500`,
    [req.userId, statuses],
  );
  res.json(rows);
};

emailsRouter.get('/scheduled', list(SCHEDULED, 'scheduled_at ASC'));
emailsRouter.get('/sent', list(SENT, 'COALESCE(sent_at, scheduled_at) DESC'));

emailsRouter.get('/counts', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE status = ANY($2))::int AS scheduled,
            count(*) FILTER (WHERE status = ANY($3))::int AS sent
     FROM emails WHERE user_id=$1`,
    [req.userId, SCHEDULED, SENT],
  );
  res.json(rows[0]);
});

// Search: Elasticsearch ranks, Postgres supplies the rows. Falls back to ILIKE if ES is down.
emailsRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const statuses = req.query.status ? String(req.query.status).split(',').filter(Boolean) : undefined;
  let ids: string[] | null = null;
  try {
    ids = await searchEmailIds(req.userId!, q, statuses);
  } catch (e) {
    console.error('[search] ES unavailable, falling back to Postgres:', (e as Error).message);
  }

  if (ids) {
    if (!ids.length) return res.json([]);
    const { rows } = await pool.query(
      `SELECT ${LIST_COLS} FROM emails WHERE id = ANY($1::uuid[]) AND user_id=$2 AND status = ANY($3)`,
      [ids, req.userId, statuses ?? [...SCHEDULED, ...SENT]],
    );
    const rank = new Map(ids.map((id, i) => [id, i]));
    return res.json(rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)));
  }

  const like = `%${q}%`;
  const { rows } = await pool.query(
    `SELECT ${LIST_COLS} FROM emails
     WHERE user_id=$1 AND status = ANY($2) AND (recipient ILIKE $3 OR subject ILIKE $3 OR body ILIKE $3)
     ORDER BY scheduled_at DESC LIMIT 200`,
    [req.userId, statuses ?? [...SCHEDULED, ...SENT], like],
  );
  res.json(rows);
});

emailsRouter.get('/:id([0-9a-fA-F-]{36})', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.recipient AS email, e.subject, e.body, e.status, e.scheduled_at, e.sent_at,
            e.preview_url, e.error, s.email AS sender_email
     FROM emails e JOIN senders s ON s.id = e.sender_id
     WHERE e.id=$1 AND e.user_id=$2`,
    [req.params.id, req.userId],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});
