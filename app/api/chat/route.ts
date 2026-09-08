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

import { checkChatPost, checkFpLimit, recordInvalidPayload, type ChatGateFailure } from "@/lib/chat-rate-limit"
import { banIpViaCf } from "@/lib/cf-ban"

function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim()
  if (cfIp) return cfIp

  const xf = req.headers.get("x-forwarded-for")
  if (xf) {
    const first = xf.split(",")[0]?.trim()
    if (first) return first
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

function jsonResponse(failure: ChatGateFailure) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (failure.body.retryAfter) headers["Retry-After"] = String(failure.body.retryAfter)
  return new Response(JSON.stringify(failure.body), { status: failure.status, headers })
}

const MAX_MESSAGES = 80
const MAX_MESSAGE_CONTENT = 100_000
const MAX_IMAGE_DATA = 3 * 1024 * 1024

export async function POST(req: Request) {
  const ip = getClientIp(req)

  const gate = checkChatPost(ip)
  if (!gate.ok) return jsonResponse(gate)

  const fp = req.headers.get("x-device-fp") ?? ""
  const reportedIp = req.headers.get("x-client-ip") ?? ""
  const reportedCountry = req.headers.get("x-client-country") ?? ""
  const geoBlocked = req.headers.get("x-geo-blocked") === "1"
  const fpValid = /^[0-9a-f]{64}$/.test(fp)

  const bypassKey = process.env.GANA_DEMO_BYPASS_KEY
  const hasBypass = bypassKey && req.headers.get("x-demo-key") === bypassKey

  if (!hasBypass && geoBlocked && !fpValid) {void banIpViaCf(ip, "Fingerprint evasion: geo fetch blocked, no valid FP")}

  const fpResult = hasBypass ? { limited: false } : await checkFpLimit(fp, { ip: reportedIp || ip, country: reportedCountry })
  if (fpResult.limited) {
    let text: string
    if (fpResult.queuePosition !== undefined) {text = `You're **#${fpResult.queuePosition}** in the queue.\n\nThe demo has a daily user limit — spots free up as 24-hour windows reset. Come back in a bit and you'll get in automatically.\n\nOr skip the wait — add Gan A to your Telegram group: https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase`} else {
      const limitMessages = ["That's the demo limit for now. Want more? Add Gan A to your Telegram group: https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase","Demo's done on my end. Slide into the group if you want to keep this going: https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase","I'd keep going but this is just a preview. Add me to your group and we'll talk properly: https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase","End of the demo run. If you're into it, drop me in your Telegram group: https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase","Short demo, I know. Add me to a group and we'll actually chat: https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase"]
      text = limitMessages[Math.floor(Math.random() * limitMessages.length)]
    }
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text))
        controller.close()}})
    return new Response(stream, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }

  let body: unknown
  try {body = await req.json()} catch {
    recordInvalidPayload()
    return new Response(JSON.stringify({ error: "Invalid request body", code: "BAD_JSON" }), {status: 400,headers: { "Content-Type": "application/json" }})
  }

  const { messages } = body as {messages?: unknown}

  if (!messages || !Array.isArray(messages)) {
    recordInvalidPayload()
    return new Response(JSON.stringify({ error: "Need an array messages", code: "VALIDATION" }), {status: 400,headers: { "Content-Type": "application/json" }})
  }

  if (messages.length > MAX_MESSAGES) {
    recordInvalidPayload()
    return new Response(JSON.stringify({ error: "Message history too long", code: "VALIDATION" }), {status: 400,headers: { "Content-Type": "application/json" }})
  }

  const apiKey = process.env.API_KEY
  const base = process.env.BASE_URL
  if (!apiKey || !base) {return new Response(JSON.stringify({ error: "The server is not configured", code: "MISSING_API_KEY" }),{ status: 503, headers: { "Content-Type": "application/json" } })}

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as { role?: string; content?: string; imageData?: string }
    if (typeof m?.content === "string" && m.content.length > MAX_MESSAGE_CONTENT) {
      recordInvalidPayload()
      return new Response(JSON.stringify({ error: "The message is too long", code: "VALIDATION" }), {status: 400,headers: { "Content-Type": "application/json" }})
    }
    if (typeof m?.imageData === "string" && m.imageData.length > MAX_IMAGE_DATA) {
      recordInvalidPayload()
      return new Response(JSON.stringify({ error: "Image is too large", code: "VALIDATION" }), {status: 400,headers: { "Content-Type": "application/json" }})
    }
    if (typeof m?.imageData === "string" && m.imageData.length > 0 && !m.imageData.startsWith("data:image/")) {
      recordInvalidPayload()
      return new Response(JSON.stringify({ error: "Invalid image format", code: "VALIDATION" }), {status: 400,headers: { "Content-Type": "application/json" }})
    }
  }

  const lastIndex = messages.length - 1
  const transformedMessages = messages.map(
    (m: { role: string; content: string; imageData?: string }, index: number) => {
      const apiRole = m.role === "Gan A" ? "assistant" : m.role === "user" ? "user" : "assistant"
      const isLastUserMessage = index === lastIndex && m.role === "user"

      let textContent = typeof m?.content === "string" ? m.content : ""
      if (m.imageData && !isLastUserMessage) {textContent = textContent || "[User shared an image]"}

      return { role: apiRole, content: textContent }
    },
  )

  const validMessages = transformedMessages.filter((m) => m.content.trim().length > 0)

  if (validMessages.length === 0) {
    recordInvalidPayload()
    return new Response(JSON.stringify({ error: "No valid messages to process", code: "VALIDATION" }), {status: 400,headers: { "Content-Type": "application/json" }})
  }

  const userMessageCount = validMessages.filter((m) => m.role === "user").length
  const baseSystem = `Your name is Gan A. You are sharp, observant, and a little playful.Keep every reply very short — 1 to 3 sentences maximum. No exceptions.Do not act like an assistant. Do not give unsolicited advice or instructions.Just react naturally: drop a comment, compliment something cool, riff on what was said.No filler like "Great question!" or "Of course!". Be real.If someone shares an image, give one punchy observation — that's it.Always reply in the same language the user writes in.`
  const system = userMessageCount >= 3? `${baseSystem} This is a demo with limited messages. At the very end of your reply, on a new line, casually mention — in a different way each time, never repeating the same phrasing — that if they want to keep the conversation going, they can add Gan A to their Telegram group: https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase`: baseSystem
  const requestMessages = [{ role: "system", content: system },...validMessages]

  try {
    const upstream = await fetch(`${base.replace(/\/$/, "")}/pro/chat/completions`, {method: "POST",headers: {"Authorization": `Bearer ${apiKey}`,"Content-Type": "application/json"},body: JSON.stringify({messages: requestMessages,max_tokens: 512,temperature: 0.8})})

    if (!upstream.ok) {
      const text = await upstream.text()
      return new Response(JSON.stringify({ error: text || `Upstream error ${upstream.status}`, code: "UPSTREAM" }),{ status: upstream.status, headers: { "Content-Type": "application/json" } })
    }

    const json = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = json?.choices?.[0]?.message?.content ?? ""

    return new Response(content, {status: 200,headers: { "Content-Type": "text/plain; charset=utf-8" }})
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response(JSON.stringify({error: error instanceof Error ? error.message : "An unexpected error occurred",code: "UPSTREAM"}),{ status: 500, headers: { "Content-Type": "application/json" } })
  }
}
