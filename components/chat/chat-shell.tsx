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

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { MessageList } from "./message-list"
import { Composer } from "./composer"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GradientBackground } from "@/components/gradient-background"
import { CoonDevIcon } from "coonlink-telegramicons"
import { clearTabVaultSecret, decryptMessageRow, decryptVaultEnvelope, encryptMessageRow, getOrCreateTabVaultSecret, type StoredPerMessageCipher, VAULT_TAB_SECRET_KEY } from "@/lib/chat-crypto"
import { getDeviceFingerprint } from "@/lib/chat-fingerprint"
import { gooeyToast } from "goey-toast"

export interface Message {
  id: string
  role: "user" | "Gan A"
  content: string
  createdAt: Date
  imageData?: string
}

const LEGACY_MESSAGES_KEY = "chat-messages"
const VAULT_SESSION_KEY = "gana-chat-v1-encrypted-vault"

interface LegacyVaultPlainDTO {
  id: string
  role: "user" | "Gan A"
  content: string
  createdAt: string
}

function legacyDtoToMessages(dto: LegacyVaultPlainDTO[]): Message[] {return dto.map((row) => ({id: row.id,role: row.role,content: row.content,createdAt: new Date(row.createdAt)}))}

function isPerMessageRow(x: unknown): x is StoredPerMessageCipher {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (typeof o.id === "string" &&(o.role === "user" || o.role === "Gan A") &&typeof o.createdAt === "string" &&typeof o.payload === "string" &&typeof o.keyWrap === "string")
}

function generateId(): string {return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`}

export function ChatShell() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const skipNextVaultSave = useRef(false)
  const retryRef = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false;(async () => {
      try {
        const raw = sessionStorage.getItem(VAULT_SESSION_KEY)
        const tabSecret = sessionStorage.getItem(VAULT_TAB_SECRET_KEY)

        if (raw && tabSecret) {
          if (raw.startsWith("GanAEncrypt:")) {
            const plain = await decryptVaultEnvelope(raw, tabSecret)
            if (!cancelled && plain) {
              const dto = JSON.parse(plain) as LegacyVaultPlainDTO[]
              if (Array.isArray(dto)) {
                skipNextVaultSave.current = true
                setMessages(legacyDtoToMessages(dto))
              }
            }
          } else if (raw.trimStart().startsWith("[")) {
            const arr = JSON.parse(raw) as unknown[]
            if (!cancelled && Array.isArray(arr) && arr.length > 0 && isPerMessageRow(arr[0])) {
              const rows = arr as StoredPerMessageCipher[]
              const parts = await Promise.all(
                rows.map(async (row) => {
                  const dec = await decryptMessageRow(row, tabSecret)
                  if (!dec) return null
                  const msg: Message = {id: dec.id,role: dec.role,content: dec.content,createdAt: new Date(dec.createdAt)}
                  if (dec.imageData) msg.imageData = dec.imageData;return msg}))
              const restored = parts.filter((m): m is Message => m !== null)
              skipNextVaultSave.current = true
              setMessages(restored)
            }
          }
        } else {
          if (raw) {
            try {sessionStorage.removeItem(VAULT_SESSION_KEY)} catch {}
          }
          const legacy = localStorage.getItem(LEGACY_MESSAGES_KEY)
          if (legacy) {
            const parsed = JSON.parse(legacy) as Message[]
            if (!cancelled && Array.isArray(parsed)) {
              skipNextVaultSave.current = true
              setMessages(parsed.map((msg) => ({...msg,createdAt: new Date(msg.createdAt)})))
            }
            localStorage.removeItem(LEGACY_MESSAGES_KEY)
          }
        }
      } catch (e) {console.error("Failed to restore chat vault:", e)} finally {if (!cancelled) setIsLoaded(true)}
    })()
    return () => {cancelled = true}
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    if (skipNextVaultSave.current) {
      skipNextVaultSave.current = false
      return
    }
    const t = window.setTimeout(() => {
      const secret = getOrCreateTabVaultSecret()
      if (messages.length === 0) {
        try {sessionStorage.removeItem(VAULT_SESSION_KEY)} catch (e) {console.error("Vault clear failed:", e)}
        return
      }
      Promise.all(messages.map((m) =>encryptMessageRow(m.id, m.role, m.createdAt.toISOString(), { content: m.content, imageData: m.imageData }, secret))).then((rows) => {try {sessionStorage.setItem(VAULT_SESSION_KEY, JSON.stringify(rows))} catch (e) {console.error("Vault save failed:", e)}}).catch((e) => console.error("Vault encrypt failed:", e))}, 450)
    return () => window.clearTimeout(t)
  }, [messages, isLoaded])

  useEffect(() => {retryRef.current = retry})
  useEffect(() => {if (!error) return;gooeyToast.error("Something went wrong", {description: error})}, [error])

  const sendMessage = useCallback(
    async (content: string, imageData?: string) => {
      if ((!content.trim() && !imageData) || isStreaming) return

      setError(null)

      const userMessage: Message = {id: generateId(),role: "user",content: content.trim() || "Describe this image",createdAt: new Date(),imageData}
      const assistantMessage: Message = {id: generateId(),role: "Gan A",content: "",createdAt: new Date()}

      const newMessages = [...messages, userMessage, assistantMessage]
      setMessages(newMessages)
      setIsStreaming(true)

      const controller = new AbortController()
      setAbortController(controller)

      try {
        const { hash: fp, geo, geoBlocked } = await getDeviceFingerprint()

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`, {method: "POST",headers: {"Content-Type": "application/json",...(fp ? { "X-Device-FP": fp } : {}),...(geo.ip ? { "X-Client-IP": geo.ip } : {}),...(geo.country ? { "X-Client-Country": geo.country } : {}),...(geoBlocked ? { "X-Geo-Blocked": "1" } : {})},body: JSON.stringify({messages: [...messages, userMessage].map((m) => ({role: m.role,content: m.content,imageData: m.imageData}))}),signal: controller.signal})

        if (!response.ok) {
          let detail = `Error ${response.status}`
          const ct = response.headers.get("content-type")
          if (ct?.includes("application/json")) {
            try {
              const j = (await response.json()) as { error?: string; code?: string }
              if (typeof j?.error === "string" && j.error.length > 0) detail = j.error
            } catch {}
          }
          if (response.status === 404) {
            setError("The chat endpoint was not found (404). Please check your deployment or try again later.")
            setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessage.id))
            setIsStreaming(false)
            setAbortController(null)
            return
          }
          throw new Error(detail)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {throw new Error("No response body")}

        let accumulatedContent = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulatedContent += chunk

          setMessages((prev) =>prev.map((msg) => (msg.id === assistantMessage.id ? { ...msg, content: accumulatedContent } : msg)))
        }

        if (!accumulatedContent.trim()) {
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessage.id))
          setError("No response received. Please try again.")
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          setMessages((prev) =>prev.map((msg) =>msg.id === assistantMessage.id ? { ...msg, content: msg.content || "[Cancelled]" } : msg))
        } else {
          console.error("Error sending message:", e)
          setError(e instanceof Error ? e.message : "An error occurred")
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessage.id))
        }
      } finally {
        setIsStreaming(false)
        setAbortController(null)
      }
    },
    [messages, isStreaming]
  )

  const retry = useCallback(() => {
    if (messages.length === 0) return
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
    if (lastUserMessage) {
      const index = messages.findIndex((m) => m.id === lastUserMessage.id)
      setMessages(messages.slice(0, index))
      setError(null)
      setTimeout(() => sendMessage(lastUserMessage.content, lastUserMessage.imageData), 100)
    }
  }, [messages, sendMessage])

  const stopStreaming = useCallback(() => {if (abortController) {abortController.abort()}}, [abortController])
  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
    localStorage.removeItem(LEGACY_MESSAGES_KEY)
    try {
      sessionStorage.removeItem(VAULT_SESSION_KEY)
    } catch {}
    clearTabVaultSecret()
  }, [])

  return (
    <div className="relative h-dvh"style={{boxShadow:"rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px"}}>
      <GradientBackground />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={clearChat}variant="ghost"size="icon"className="absolute top-4 left-4 z-20 h-10 w-10 rounded-full border"style={{borderColor: "#ffffff26",backgroundColor: "#ffffff1a",color: "#ffffff"}}aria-label="Reset chat"><CoonDevIcon.I000443 className="w-9 h-9" /></Button>
        </TooltipTrigger>
        <TooltipContent className="bg-white text-black" side="right">
          <p className="text-sm font-gilroy">Reset chat</p>
        </TooltipContent>
      </Tooltip>

      <MessageList messages={messages} isStreaming={isStreaming} isLoaded={isLoaded} />

      <Composer onSend={sendMessage}onStop={stopStreaming}isStreaming={isStreaming}disabled={!!error}/>
    </div>
  )
}
