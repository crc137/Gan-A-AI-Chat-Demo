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

const WINDOW_MS = Number(process.env.CHAT_RL_WINDOW_MS || 300_000)
const IP_SOFT = Number(process.env.CHAT_RL_IP_SOFT || 40)
const IP_HARD = Number(process.env.CHAT_RL_IP_HARD || 160)
const GLOBAL_FREEZE_MS = Number(process.env.CHAT_GLOBAL_FREEZE_MS || 2 * 60 * 60 * 1000)
const GLOBAL_FREEZE_LONG_MS = Number(process.env.CHAT_GLOBAL_FREEZE_LONG_MS || 24 * 60 * 60 * 1000)
const INVALID_WINDOW_MS = Number(process.env.CHAT_INVALID_WINDOW_MS || 600_000)
const INVALID_MAX = Number(process.env.CHAT_INVALID_MAX || 50)
let globalFreezeUntil = 0

const ipTimestamps = new Map<string, number[]>()
const invalidTimestamps: number[] = []

function pruneWindow(ts: number[], windowMs: number, now: number): number[] {
  return ts.filter((t) => now - t < windowMs)
}

export type ChatGateFailure = {
  ok: false
  status: number
  body: { error: string; code: string; retryAfter?: number }
}

export type ChatGateOk = { ok: true }

export type ChatGate = ChatGateOk | ChatGateFailure

function freezeAll(now: number, long: boolean) {
  globalFreezeUntil = now + (long ? GLOBAL_FREEZE_LONG_MS : GLOBAL_FREEZE_MS)
}

export function checkChatPost(ip: string): ChatGate {
  const now = Date.now()
  if (now < globalFreezeUntil) {
    return {
      ok: false,
      status: 503,
      body: {
        error:
          "Service temporarily unavailable: abnormal or malicious activity detected. Please try again later.",
        code: "SECURITY_FREEZE",
        retryAfter: Math.max(1, Math.ceil((globalFreezeUntil - now) / 1000)),
      },
    }
  }

  const list = pruneWindow(ipTimestamps.get(ip) ?? [], WINDOW_MS, now)

  if (list.length >= IP_HARD) {
    freezeAll(now, false)
    return {
      ok: false,
      status: 503,
      body: {
        error:
          "Maximum allowable requests from this address exceeded. Chat is temporarily locked for all users for a few hours in protection mode.",
        code: "SECURITY_FREEZE",
        retryAfter: Math.ceil(GLOBAL_FREEZE_MS / 1000),
      },
    }
  }

  if (list.length >= IP_SOFT) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "Too many requests from your address. Please wait a few minutes.",
        code: "RATE_LIMIT_IP",
        retryAfter: Math.ceil(WINDOW_MS / 1000),
      },
    }
  }

  list.push(now)
  ipTimestamps.set(ip, list)
  return { ok: true }
}

export async function checkFpLimit(
  fp: string,
  meta?: { ip?: string; country?: string },
): Promise<import("./fp-store").FpCheckResult> {
  if (!fp || !/^[0-9a-f]{64}$/.test(fp)) return { limited: false }
  const { checkAndRecordFp } = await import("./fp-store")
  return checkAndRecordFp(fp, meta ?? {})
}

export function recordInvalidPayload(): void {
  const now = Date.now()
  if (now < globalFreezeUntil) return

  const inv = pruneWindow(invalidTimestamps, INVALID_WINDOW_MS, now)
  invalidTimestamps.length = 0
  invalidTimestamps.push(...inv, now)

  if (invalidTimestamps.length >= INVALID_MAX) {
    freezeAll(now, true)
  }
}