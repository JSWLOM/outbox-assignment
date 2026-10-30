import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { migrate, pool } from './db';
import { ensureSenders } from './mailer';
import { ensureIndex } from './search';
import { emailQueue } from './queue';
import { authRouter, ensureDevUser, requireAuth } from './routes/auth';
import { emailsRouter } from './routes/emails';
import { slackRouter } from './routes/slack';

async function main() {
  await migrate();
  await ensureSenders();
  await ensureIndex();
  if (config.devAuthBypass) await ensureDevUser();

  const app = express();
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Live BullMQ dashboard (basic auth)
  const board = new ExpressAdapter();
  board.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: board });
  const basic = (req: Request, res: Response, next: NextFunction) => {
    const [u, p] = Buffer.from((req.headers.authorization ?? '').replace('Basic ', ''), 'base64').toString().split(':');
    if (u === config.bullBoard.user && p === config.bullBoard.pass) return next();
    res.set('WWW-Authenticate', 'Basic realm="queues"').status(401).send('Auth required');
  };
  app.use('/admin/queues', basic, board.getRouter());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/senders', requireAuth, async (_req, res) => {
    const { rows } = await pool.query('SELECT id, email FROM senders ORDER BY id');
    res.json(rows);
  });
  app.use('/auth', authRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/slack', slackRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(config.port, () => console.log(`[api] http://localhost:${config.port} | queues: /admin/queues`));
}

main().catch((e) => { console.error(e); process.exit(1); });
