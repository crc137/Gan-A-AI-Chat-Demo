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

const KEY_CACHE_MAX = 48
const _keyCache = new Map<string, CryptoKey>()

let _tabWrapKeyCache: { tabSecret: string; key: CryptoKey } | null = null

function getOriginPattern(): string {
  if (typeof window === "undefined") return "https://localhost/"
  const url = new URL(window.location.href)
  const base = `${url.protocol}//${url.host}`
  return base.endsWith("/") ? base : `${base}/`
}

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]))
  }
  return btoa(parts.join(""))
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function asBufferSource(u: Uint8Array): BufferSource {
  return u as BufferSource
}

function _keyCacheId(password: string, salt: string, usage: string, iterations: number) {
  return `${usage}:${iterations}:${salt}:${password}`
}

async function getCachedKey(
  password: string,
  saltValue: string,
  usage: "encrypt" | "decrypt",
  iterations = 210000,
): Promise<CryptoKey> {
  const id = _keyCacheId(password, saltValue, usage, iterations)
  if (_keyCache.has(id)) return _keyCache.get(id)!

  if (_keyCache.size >= KEY_CACHE_MAX) {
    const oldest = _keyCache.keys().next().value
    if (oldest !== undefined) _keyCache.delete(oldest)
  }

  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(saltValue),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  )
  _keyCache.set(id, key)
  return key
}

function parseBracketPayload(text: string, prefix: string) {
  if (!text.startsWith(prefix) || !text.endsWith(">")) return null
  const inner = text.slice(prefix.length, -1)
  const sepIdx = inner.indexOf(":")
  if (sepIdx < 1) return null
  try {
    const iv = base64ToUint8(inner.slice(0, sepIdx))
    const data = base64ToUint8(inner.slice(sepIdx + 1))
    if (iv.length !== 12) return null
    return { iv, data }
  } catch {
    return null
  }
}

function parseEncryptedPayload(text: string) {
  if (text.startsWith("GanAEncrypt:<")) return parseBracketPayload(text, "GanAEncrypt:<")
  return null
}

export async function decryptVaultEnvelope(text: string, password: string): Promise<string | null> {
  const payload = parseEncryptedPayload(text)
  if (!payload) return null
  const { iv, data } = payload
  const dec = new TextDecoder()
  const origin = getOriginPattern()

  const attempts = [
    { salt: `GanAEncrypt-v1-${origin}`, iters: 210000 },
    { salt: `GanAEncrypt-v1-${origin}`, iters: 100000 },
    { salt: "a-unique-salt", iters: 100000 },
  ] as const

  for (const { salt, iters } of attempts) {
    try {
      const key = await getCachedKey(password, salt, "decrypt", iters)
      const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(data))
      return dec.decode(buf)
    } catch {
      continue
    }
  }
  return null
}

export async function encryptVaultEnvelope(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = `GanAEncrypt-v1-${getOriginPattern()}`
  const key = await getCachedKey(password, salt, "encrypt", 210000)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(enc.encode(plaintext)))
  return `GanAEncrypt:<${uint8ToBase64(iv)}:${uint8ToBase64(new Uint8Array(ciphertext))}>`
}

export async function getTabWrapKey(tabSecret: string): Promise<CryptoKey> {
  if (_tabWrapKeyCache?.tabSecret === tabSecret) return _tabWrapKeyCache.key

  const enc = new TextEncoder()
  const salt = `GanaTabWrap-v1-${getOriginPattern()}`
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    asBufferSource(enc.encode(tabSecret)),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 210000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
  _tabWrapKeyCache = { tabSecret, key }
  return key
}

function parseGanaAePayload(text: string) {
  return parseBracketPayload(text, "GanaAE:<")
}

async function aesGcmEncryptWithKey(key: CryptoKey, plainBytes: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(plainBytes))
  return `GanaAE:<${uint8ToBase64(iv)}:${uint8ToBase64(new Uint8Array(ct))}>`
}

async function aesGcmDecryptWithKey(key: CryptoKey, envelope: string): Promise<Uint8Array | null> {
  const p = parseGanaAePayload(envelope)
  if (!p) return null
  try {
    const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBufferSource(p.iv) }, key, asBufferSource(p.data))
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

async function encryptWithRawMessageKey(utf8Json: string, messageKey32: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    asBufferSource(messageKey32),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  )
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(enc.encode(utf8Json)))
  return `GanaAE:<${uint8ToBase64(iv)}:${uint8ToBase64(new Uint8Array(ct))}>`
}

async function decryptWithRawMessageKey(envelope: string, messageKey32: Uint8Array): Promise<string | null> {
  const key = await crypto.subtle.importKey(
    "raw",
    asBufferSource(messageKey32),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  )
  const p = parseGanaAePayload(envelope)
  if (!p) return null
  const dec = new TextDecoder()
  try {
    const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBufferSource(p.iv) }, key, asBufferSource(p.data))
    return dec.decode(buf)
  } catch {
    return null
  }
}

export interface MessageCipherPayload {
  content: string
  imageData?: string
}

export interface StoredPerMessageCipher {
  id: string
  role: "user" | "Gan A"
  createdAt: string
  payload: string
  keyWrap: string
}

export async function encryptMessageRow(
  id: string,
  role: "user" | "Gan A",
  createdAtIso: string,
  inner: MessageCipherPayload,
  tabSecret: string,
): Promise<StoredPerMessageCipher> {
  const msgKey = crypto.getRandomValues(new Uint8Array(32))
  const payload = await encryptWithRawMessageKey(JSON.stringify(inner), msgKey)
  const tabWrap = await getTabWrapKey(tabSecret)
  const keyWrap = await aesGcmEncryptWithKey(tabWrap, msgKey)
  return { id, role, createdAt: createdAtIso, payload, keyWrap }
}

export async function decryptMessageRow(
  row: StoredPerMessageCipher,
  tabSecret: string,
): Promise<(MessageCipherPayload & { id: string; role: "user" | "Gan A"; createdAt: string }) | null> {
  const tabWrap = await getTabWrapKey(tabSecret)
  const msgKey = await aesGcmDecryptWithKey(tabWrap, row.keyWrap)
  if (!msgKey || msgKey.length !== 32) return null
  const json = await decryptWithRawMessageKey(row.payload, msgKey)
  if (!json) return null
  let inner: MessageCipherPayload
  try {
    inner = JSON.parse(json) as MessageCipherPayload
  } catch {
    return null
  }
  return { ...inner, id: row.id, role: row.role, createdAt: row.createdAt }
}

export const VAULT_TAB_SECRET_KEY = "gana-chat-tab-secret"

export function getOrCreateTabVaultSecret(): string {
  let s = sessionStorage.getItem(VAULT_TAB_SECRET_KEY)
  if (!s) {
    s = uint8ToBase64(crypto.getRandomValues(new Uint8Array(32)))
    sessionStorage.setItem(VAULT_TAB_SECRET_KEY, s)
  }
  return s
}

export function clearTabVaultSecret(): void {
  sessionStorage.removeItem(VAULT_TAB_SECRET_KEY)
  _tabWrapKeyCache = null
}
