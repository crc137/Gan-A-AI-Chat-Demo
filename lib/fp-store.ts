/*
✨ CoonDev • https://dev.coonlink.com/

 ▄█▄    ████▄ ████▄    ▄   ██▄   ▄███▄      ▄
 █▀ ▀▄  █   █ █   █     █  █  █  █▀   ▀      █
 █   ▀  █   █ █   █ ██   █ █   █ ██▄▄   █     █
 █▄  ▄▀ ▀████ ▀████ █ █  █ █  █  █▄   ▄▀ █    █
 ▀███▀              █  █ █ ███▀  ▀███▀    █  █
                    █   ██                 █▐
                                           ▐
*/

import { getPool } from "./db"

const DEMO_FP_LIMIT = Number(process.env.CHAT_DEMO_FP_LIMIT || 3)
const DEMO_FP_WINDOW_MS = Number(process.env.CHAT_DEMO_FP_WINDOW_MS || 24 * 60 * 60 * 1000)
const DAILY_USER_LIMIT = Number(process.env.CHAT_DAILY_USER_LIMIT || 0)

export type FpCheckResult = {
  limited: boolean
  queuePosition?: number
}

let tableReady = false

async function ensureTable(): Promise<void> {
  if (tableReady) return
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fp_rate_limit (
      hash         CHAR(64) PRIMARY KEY,
      count        INTEGER  NOT NULL DEFAULT 1,
      window_start BIGINT   NOT NULL,
      last_seen    BIGINT   NOT NULL,
      ips          TEXT[]   NOT NULL DEFAULT '{}',
      countries    TEXT[]   NOT NULL DEFAULT '{}',
      queued       BOOLEAN  NOT NULL DEFAULT false,
      queued_at    BIGINT
    )
  `)
  await pool.query(`ALTER TABLE fp_rate_limit ADD COLUMN IF NOT EXISTS queued BOOLEAN NOT NULL DEFAULT false`)
  await pool.query(`ALTER TABLE fp_rate_limit ADD COLUMN IF NOT EXISTS queued_at BIGINT`)
  tableReady = true
}

// $1=hash $2=now $3=ip|null $4=country|null
const SQL_UPDATE_META = `
  UPDATE fp_rate_limit SET
    last_seen = $2,
    ips       = CASE WHEN $3::text IS NULL OR $3::text = ANY(ips)       THEN ips       ELSE array_append(ips,       $3::text) END,
    countries = CASE WHEN $4::text IS NULL OR $4::text = ANY(countries) THEN countries ELSE array_append(countries, $4::text) END
  WHERE hash = $1`

const SQL_UPDATE_INC = `
  UPDATE fp_rate_limit SET
    count     = count + 1,
    last_seen = $2,
    ips       = CASE WHEN $3::text IS NULL OR $3::text = ANY(ips)       THEN ips       ELSE array_append(ips,       $3::text) END,
    countries = CASE WHEN $4::text IS NULL OR $4::text = ANY(countries) THEN countries ELSE array_append(countries, $4::text) END
  WHERE hash = $1`

export async function checkAndRecordFp(
  hash: string,
  meta: { ip?: string; country?: string },
): Promise<FpCheckResult> {
  try {
    await ensureTable()
  } catch {
    return { limited: false }
  }

  const pool = getPool()
  const now = Date.now()
  const ip = meta.ip || null
  const country = meta.country || null
  const params = [hash, now, ip, country]

  try {
    const sel = await pool.query<{
      count: number
      window_start: string
      queued: boolean
      queued_at: string | null
    }>(
      "SELECT count, window_start, queued, queued_at FROM fp_rate_limit WHERE hash = $1",
      [hash],
    )

    if (sel.rows.length === 0) {
      // IP already burned through limit under a different fingerprint
      if (ip) {
        const burned = await pool.query(
          `SELECT 1 FROM fp_rate_limit
           WHERE $1 = ANY(ips)
             AND count >= $2
             AND ($3::bigint - window_start) < $4
           LIMIT 1`,
          [ip, DEMO_FP_LIMIT, now, DEMO_FP_WINDOW_MS],
        )
        if (burned.rows.length > 0) {
          await pool.query(
            `INSERT INTO fp_rate_limit (hash, count, window_start, last_seen, ips, countries, queued)
             VALUES ($1, $2, $3, $3,
               CASE WHEN $4::text IS NULL THEN '{}' ELSE ARRAY[$4::text] END,
               CASE WHEN $5::text IS NULL THEN '{}' ELSE ARRAY[$5::text] END,
               false
             ) ON CONFLICT DO NOTHING`,
            [hash, DEMO_FP_LIMIT, now, ip, country],
          )
          return { limited: true }
        }
      }

      // Daily unique user quota
      if (DAILY_USER_LIMIT > 0) {
        const activeRes = await pool.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM fp_rate_limit WHERE queued = false AND ($1::bigint - window_start) < $2`,
          [now, DEMO_FP_WINDOW_MS],
        )
        const activeCount = Number(activeRes.rows[0].cnt)
        if (activeCount >= DAILY_USER_LIMIT) {
          await pool.query(
            `INSERT INTO fp_rate_limit (hash, count, window_start, last_seen, ips, countries, queued, queued_at)
             VALUES ($1, 0, $2, $2,
               CASE WHEN $3::text IS NULL THEN '{}' ELSE ARRAY[$3::text] END,
               CASE WHEN $4::text IS NULL THEN '{}' ELSE ARRAY[$4::text] END,
               true, $2
             ) ON CONFLICT DO NOTHING`,
            [hash, now, ip, country],
          )
          const posRes = await pool.query<{ pos: string }>(
            `SELECT COUNT(*) AS pos FROM fp_rate_limit WHERE queued = true AND queued_at <= $1`,
            [now],
          )
          return { limited: true, queuePosition: Number(posRes.rows[0].pos) }
        }
      }

      await pool.query(
        `INSERT INTO fp_rate_limit (hash, count, window_start, last_seen, ips, countries)
         VALUES (
           $1, 1, $2, $2,
           CASE WHEN $3::text IS NULL THEN '{}' ELSE ARRAY[$3::text] END,
           CASE WHEN $4::text IS NULL THEN '{}' ELSE ARRAY[$4::text] END
         ) ON CONFLICT DO NOTHING`,
        params,
      )
      return { limited: false }
    }

    const row = sel.rows[0]
    const windowExpired = now - Number(row.window_start) >= DEMO_FP_WINDOW_MS

    // Queued user — check if a spot opened up
    if (row.queued) {
      if (DAILY_USER_LIMIT > 0 && !windowExpired) {
        const activeRes = await pool.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM fp_rate_limit WHERE queued = false AND ($1::bigint - window_start) < $2`,
          [now, DEMO_FP_WINDOW_MS],
        )
        if (Number(activeRes.rows[0].cnt) < DAILY_USER_LIMIT) {
          await pool.query(
            `UPDATE fp_rate_limit SET
               count = 1, window_start = $2, last_seen = $2, queued = false, queued_at = NULL,
               ips       = CASE WHEN $3::text IS NULL OR $3::text = ANY(ips)       THEN ips       ELSE array_append(ips,       $3::text) END,
               countries = CASE WHEN $4::text IS NULL OR $4::text = ANY(countries) THEN countries ELSE array_append(countries, $4::text) END
             WHERE hash = $1`,
            params,
          )
          return { limited: false }
        }
      }
      const queuedAt = row.queued_at ? Number(row.queued_at) : now
      const posRes = await pool.query<{ pos: string }>(
        `SELECT COUNT(*) AS pos FROM fp_rate_limit WHERE queued = true AND queued_at <= $1`,
        [queuedAt],
      )
      return { limited: true, queuePosition: Number(posRes.rows[0].pos) }
    }

    if (windowExpired) {
      await pool.query(
        `UPDATE fp_rate_limit SET
           count = 1, window_start = $2, last_seen = $2, queued = false, queued_at = NULL,
           ips       = CASE WHEN $3::text IS NULL THEN '{}' ELSE ARRAY[$3::text] END,
           countries = CASE WHEN $4::text IS NULL THEN '{}' ELSE ARRAY[$4::text] END
         WHERE hash = $1`,
        params,
      )
      return { limited: false }
    }

    if (row.count >= DEMO_FP_LIMIT) {
      await pool.query(SQL_UPDATE_META, params)
      return { limited: true }
    }

    await pool.query(SQL_UPDATE_INC, params)
    return { limited: false }
  } catch {
    return { limited: false }
  }
}
