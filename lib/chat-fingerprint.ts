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

const FP_CACHE_KEY = "gana-fp-v1"
const GEO_CACHE_KEY = "gana-geo-v1"

export interface DeviceGeo {
  ip: string
  country: string
  city: string
  asn: number | null
  continent: string
}

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function getCanvasSignal(): string {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext("2d")
    if (!ctx) return "no-ctx"
    ctx.textBaseline = "top"
    ctx.font = "14px Arial"
    ctx.fillStyle = "#f60"
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = "#069"
    ctx.fillText("GanA™probe~®♥", 2, 8)
    ctx.fillStyle = "rgba(0,200,100,0.5)"
    ctx.arc(100, 32, 20, 0, Math.PI * 2)
    ctx.fill()
    return canvas.toDataURL()
  } catch {
    return "canvas-blocked"
  }
}

function getWebGLSignal(): string {
  try {
    const canvas = document.createElement("canvas")
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return "no-webgl"
    const dbg = gl.getExtension("WEBGL_debug_renderer_info")
    if (!dbg) return (gl.getParameter(gl.RENDERER) as string | null) ?? "no-dbg"
    const vendor = (gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string | null) ?? ""
    const renderer = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string | null) ?? ""
    return `${vendor}::${renderer}`
  } catch {
    return "webgl-blocked"
  }
}

function getNavigatorSignals(): string {
  const n = navigator
  return [
    n.language,
    (n.languages ?? []).join(","),
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? n.platform,
    n.hardwareConcurrency ?? -1,
    (n as { deviceMemory?: number }).deviceMemory ?? -1,
    n.cookieEnabled,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen.width,
    screen.height,
    screen.colorDepth,
    screen.pixelDepth,
    window.devicePixelRatio,
  ].join("|")
}

async function fetchGeo(): Promise<DeviceGeo> {
  const empty: DeviceGeo = { ip: "", country: "", city: "", asn: null, continent: "" }
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as DeviceGeo
      if (parsed.ip) return parsed
    }
  } catch { /* ignore */ }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch("https://ipv4-check-perf.radar.cloudflare.com/", {
      signal: ctrl.signal,
      cache: "no-store",
    })
    clearTimeout(timer)
    if (!res.ok) return empty
    const data = await res.json() as {
      ip_address?: string
      country?: string
      city?: string
      asn?: number
      continent?: string
    }
    const geo: DeviceGeo = {
      ip: data.ip_address ?? "",
      country: data.country ?? "",
      city: data.city ?? "",
      asn: data.asn ?? null,
      continent: data.continent ?? "",
    }
    try { sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo)) } catch { /* ignore */ }
    return geo
  } catch {
    return empty
  }
}

export interface FingerprintResult {
  hash: string
  geo: DeviceGeo
  geoBlocked: boolean
}

export async function getDeviceFingerprint(): Promise<FingerprintResult> {
  const emptyGeo: DeviceGeo = { ip: "", country: "", city: "", asn: null, continent: "" }
  let geo = emptyGeo
  let geoBlocked = false

  try {
    geo = await fetchGeo()
    if (!geo.ip) geoBlocked = true
  } catch {
    geoBlocked = true
    geo = emptyGeo
  }

  try {
    const cached = sessionStorage.getItem(FP_CACHE_KEY)
    if (cached && /^[0-9a-f]{64}$/.test(cached)) return { hash: cached, geo, geoBlocked }
  } catch { /* private mode */ }

  const raw = [
    getCanvasSignal(),
    getWebGLSignal(),
    getNavigatorSignals(),
    navigator.userAgent,
  ].join("###")

  const hash = await sha256(raw)

  try { sessionStorage.setItem(FP_CACHE_KEY, hash) } catch { /* private mode */ }

  return { hash, geo, geoBlocked }
}
