import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';
import { requireAuth } from './auth';

export const slackRouter = Router();
const redirectUri = config.slack.redirectUri;

// Frontend calls this -> gets the real Slack authorize URL (state = signed user id)
slackRouter.get('/connect', requireAuth, (req, res) => {
  const state = jwt.sign({ uid: req.userId }, config.jwtSecret, { expiresIn: '10m' });
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.search = new URLSearchParams({ client_id: config.slack.clientId, scope: 'incoming-webhook', redirect_uri: redirectUri, state }).toString();
  res.json({ url: url.toString() });
});

// Slack redirects here (no cookie dependency: identity comes from signed state)
slackRouter.get('/callback', async (req, res) => {
  try {
    const { uid } = jwt.verify(String(req.query.state), config.jwtSecret) as { uid: string };
    const r = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code), client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret, redirect_uri: redirectUri,
      }),
    });
    const data: any = await r.json();
    if (!data.ok) throw new Error(data.error);
    await pool.query(
      `INSERT INTO slack_connections(user_id, webhook_url, channel, team_name) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET webhook_url=EXCLUDED.webhook_url, channel=EXCLUDED.channel, team_name=EXCLUDED.team_name`,
      [uid, data.incoming_webhook.url, data.incoming_webhook.channel, data.team?.name],
    );
    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (e) {
    console.error('[slack] oauth failed', (e as Error).message);
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
  }
});

slackRouter.get('/status', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT channel, team_name FROM slack_connections WHERE user_id=$1', [req.userId]);
  res.json({ connected: !!rows[0], ...(rows[0] ?? {}) });
});

slackRouter.delete('/', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM slack_connections WHERE user_id=$1', [req.userId]);
  res.json({ connected: false });
});
