import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS senders (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INT NOT NULL,
      smtp_secure BOOLEAN NOT NULL DEFAULT false,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      batch_id UUID NOT NULL,
      sender_id INT NOT NULL REFERENCES senders(id),
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | processing | sent | failed
      scheduled_at TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ,
      hourly_limit INT,
      seq INT NOT NULL DEFAULT 0,
      attempts INT NOT NULL DEFAULT 0,
      message_id TEXT,
      preview_url TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emails_user_status ON emails(user_id, status, scheduled_at);
    CREATE TABLE IF NOT EXISTS slack_connections (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      webhook_url TEXT NOT NULL,
      channel TEXT,
      team_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
