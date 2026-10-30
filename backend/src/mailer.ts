import nodemailer, { Transporter } from 'nodemailer';
import { pool } from './db';
import { config } from './config';

const transports = new Map<number, Transporter>();

/** Creates Ethereal test accounts on first boot so we have multiple senders. */
export async function ensureSenders() {
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM senders');
  for (let i = rows[0].c; i < config.senderCount; i++) {
    const a = await nodemailer.createTestAccount();
    await pool.query(
      'INSERT INTO senders(email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass) VALUES ($1,$2,$3,$4,$5,$6)',
      [a.user, a.smtp.host, a.smtp.port, a.smtp.secure, a.user, a.pass],
    );
  }
}

function getTransport(s: any): Transporter {
  let t = transports.get(s.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: s.smtp_host, port: s.smtp_port, secure: s.smtp_secure,
      auth: { user: s.smtp_user, pass: s.smtp_pass },
    });
    transports.set(s.id, t);
  }
  return t;
}

export async function sendEmail(senderId: number, to: string, subject: string, body: string) {
  const { rows } = await pool.query('SELECT * FROM senders WHERE id=$1', [senderId]);
  const sender = rows[0];
  const isHtml = /<[a-z][\s\S]*>/i.test(body);
  const info = await getTransport(sender).sendMail({
    from: `"Outbox Scheduler" <${sender.email}>`,
    to, subject,
    text: isHtml ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : body,
    html: isHtml ? body : body.replace(/\n/g, '<br/>'),
  });
  return { messageId: info.messageId as string, previewUrl: (nodemailer.getTestMessageUrl(info) || null) as string | null };
}
