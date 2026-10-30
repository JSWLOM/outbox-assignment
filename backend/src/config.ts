import 'dotenv/config';

const num = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
const str = (k: string, d = '') => process.env[k] ?? d;

export const config = {
  port: num('PORT', 4000),
  backendUrl: str('BACKEND_URL', 'http://localhost:4000'),
  frontendUrl: str('FRONTEND_URL', 'http://localhost:3000'),
  databaseUrl: str('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/scheduler'),
  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),
  esUrl: str('ELASTICSEARCH_URL', 'http://localhost:9200'),
  esApiKey: str('ELASTICSEARCH_API_KEY'),
  esUser: str('ELASTICSEARCH_USER'),
  esPass: str('ELASTICSEARCH_PASS'),
  devAuthBypass: process.env.DEV_AUTH_BYPASS === 'true',
  jwtSecret: str('JWT_SECRET', 'dev-secret'),
  google: { clientId: str('GOOGLE_CLIENT_ID'), clientSecret: str('GOOGLE_CLIENT_SECRET') },
  slack: {
    clientId: str('SLACK_CLIENT_ID'),
    clientSecret: str('SLACK_CLIENT_SECRET'),
    redirectUri: str('SLACK_REDIRECT_URI', `${str('BACKEND_URL', 'http://localhost:4000')}/api/slack/callback`),
  },
  worker: {
    concurrency: num('WORKER_CONCURRENCY', 5),
    minDelayMs: num('MIN_DELAY_BETWEEN_EMAILS_MS', 2000),
  },
  maxEmailsPerHourPerSender: num('MAX_EMAILS_PER_HOUR_PER_SENDER', 100),
  senderCount: num('SENDER_COUNT', 3),
  bullBoard: { user: str('BULL_BOARD_USER', 'admin'), pass: str('BULL_BOARD_PASS', 'admin') },
};
