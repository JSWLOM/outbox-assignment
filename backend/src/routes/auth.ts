import { Router, Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';

declare global { namespace Express { interface Request { userId?: string } } }

const client = new OAuth2Client(config.google.clientId, config.google.clientSecret, `${config.backendUrl}/auth/google/callback`);
export const authRouter = Router();

export const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function ensureDevUser() {
  await pool.query(
    "INSERT INTO users(id, google_id, email, name) VALUES ($1,'dev','dev@example.com','Dev User') ON CONFLICT DO NOTHING",
    [DEV_USER_ID],
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { uid } = jwt.verify(req.cookies?.token, config.jwtSecret) as { uid: string };
    req.userId = uid;
    next();
  } catch {
    if (config.devAuthBypass) { req.userId = DEV_USER_ID; return next(); }
    res.status(401).json({ error: 'Unauthenticated' });
  }
}

authRouter.get('/google', (_req, res) => {
  res.redirect(client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], prompt: 'select_account' }));
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const { tokens } = await client.getToken(String(req.query.code));
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: config.google.clientId });
    const p = ticket.getPayload()!;
    const { rows } = await pool.query(
      `INSERT INTO users(google_id, email, name, avatar) VALUES ($1,$2,$3,$4)
       ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, avatar=EXCLUDED.avatar
       RETURNING id`,
      [p.sub, p.email, p.name, p.picture],
    );
    const token = jwt.sign({ uid: rows[0].id }, config.jwtSecret, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (e) {
    console.error('[auth] callback failed', (e as Error).message);
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, email, name, avatar FROM users WHERE id=$1', [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'Unauthenticated' });
  res.json(rows[0]);
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});
