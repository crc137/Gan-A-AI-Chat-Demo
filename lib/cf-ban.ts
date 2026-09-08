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

const CF_API = "https://api.cloudflare.com/client/v4"

export async function banIpViaCf(ip: string, reason: string): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!zoneId || !token) return
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return

  try {
    await fetch(`${CF_API}/zones/${zoneId}/firewall/access_rules/rules`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "block",
        configuration: { target: "ip", value: ip },
        notes: reason,
      }),
    })
  } catch {
    /* fail silently — banning is best-effort */
  }
}
