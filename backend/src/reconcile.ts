import { pool } from './db';
import { enqueueEmails } from './queue';

/**
 * On boot, re-enqueue any DB-pending email (safety net if Redis lost data).
 * Duplicate jobIds are ignored by BullMQ, so this never double-sends.
 */
export async function reconcile() {
  let lastId = '00000000-0000-0000-0000-000000000000';
  let total = 0;
  for (;;) {
    const { rows } = await pool.query(
      "SELECT id, scheduled_at FROM emails WHERE status IN ('scheduled','processing') AND id > $1 ORDER BY id LIMIT 1000",
      [lastId],
    );
    if (!rows.length) break;
    await enqueueEmails(rows);
    lastId = rows[rows.length - 1].id;
    total += rows.length;
  }
  console.log(`[reconcile] checked ${total} pending emails`);
}
