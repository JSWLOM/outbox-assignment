import { Client } from '@elastic/elasticsearch';
import { config } from './config';

export const es = new Client({
  node: config.esUrl,
  auth: config.esApiKey
    ? { apiKey: config.esApiKey }
    : config.esUser
    ? { username: config.esUser, password: config.esPass }
    : undefined,
});
const INDEX = 'emails';

export async function ensureIndex() {
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      await es.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            user_id: { type: 'keyword' },
            status: { type: 'keyword' },
            recipient: { type: 'text', fields: { raw: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            scheduled_at: { type: 'date' },
            sent_at: { type: 'date' },
          },
        },
      });
    }
  } catch (e) {
    console.error('[es] ensureIndex failed', e);
  }
}

const toDoc = (r: any) => ({
  user_id: r.user_id, status: r.status, recipient: r.recipient, subject: r.subject,
  body: r.body, scheduled_at: r.scheduled_at, sent_at: r.sent_at,
});

export async function indexEmails(rows: any[]) {
  if (!rows.length) return;
  try {
    for (let i = 0; i < rows.length; i += 1000) {
      const ops = rows.slice(i, i + 1000).flatMap((r) => [{ index: { _index: INDEX, _id: r.id } }, toDoc(r)]);
      await es.bulk({ operations: ops });
    }
  } catch (e) { console.error('[es] bulk index failed', (e as Error).message); }
}

export async function updateEmailDoc(id: string, doc: Record<string, unknown>) {
  try { await es.update({ index: INDEX, id, doc }); }
  catch (e) { console.error('[es] update failed', (e as Error).message); }
}

/** Returns matching email ids (best match first). Throws if Elasticsearch is unavailable. */
export async function searchEmailIds(userId: string, q: string, statuses?: string[]): Promise<string[]> {
  const filter: any[] = [{ term: { user_id: userId } }];
  if (statuses?.length) filter.push({ terms: { status: statuses } });
  const res = await es.search({
    index: INDEX,
    size: 200,
    query: {
      bool: {
        filter,
        must: q
          ? [{ multi_match: { query: q, fields: ['recipient^2', 'subject', 'body'], fuzziness: 'AUTO' } }]
          : [{ match_all: {} }],
      },
    },
  });
  return res.hits.hits.map((h) => h._id as string);
}
