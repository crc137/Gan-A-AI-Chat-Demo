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

import { useEffect, useRef, useState } from "react"
import { MessageBubble } from "./message-bubble"
import type { Message } from "./chat-shell"
import { TypingIndicator } from "./typing-indicator"
import { AnimatedOrb } from "./animated-orb"

interface MessageListProps {
  messages: Message[]
  isStreaming: boolean
  isLoaded: boolean
}

const LAUNCH_SOUND_URL = `https://cdn.coonlink.com/cloud/GanADemoChat/launch.mp3`

export function MessageList({ messages, isStreaming, isLoaded }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const rafRef = useRef<number | null>(null)
  const [hasAnimated, setHasAnimated] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastScrollRef = useRef<number>(0)
  const hasPlayedIntroRef = useRef(false)

  useEffect(() => {
    if (!isLoaded) return

    if (messages.length === 0 && !hasPlayedIntroRef.current) {
      setHasAnimated(true)
      hasPlayedIntroRef.current = true

      audioRef.current = new Audio(LAUNCH_SOUND_URL)
      audioRef.current.volume = 0.5
      audioRef.current.play().catch(() => {
      })
    } else if (messages.length > 0) {
      setHasAnimated(false)
      hasPlayedIntroRef.current = true
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [isLoaded, messages.length])

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    container.scrollTop = container.scrollHeight
    setAutoScroll(true)
  }, [messages.length])

  useEffect(() => {
    if (!isStreaming || !autoScroll || !containerRef.current) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    const container = containerRef.current
    lastScrollRef.current = container.scrollTop

    const smoothScroll = () => {
      if (!container) return

      const { scrollHeight, clientHeight } = container
      const targetScroll = scrollHeight - clientHeight
      const currentScroll = lastScrollRef.current
      const diff = targetScroll - currentScroll

      if (diff > 0.5) {
        const newScroll = currentScroll + diff * 0.03
        lastScrollRef.current = newScroll
        container.scrollTop = newScroll
      }

      rafRef.current = requestAnimationFrame(smoothScroll)
    }

    rafRef.current = requestAnimationFrame(smoothScroll)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isStreaming, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current || isStreaming) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150
    setAutoScroll(isAtBottom)
  }

  const lastMessage = messages[messages.length - 1]
  const showTypingIndicator =
    isStreaming &&
    (messages.length === 0 ||
      lastMessage?.role === "user" ||
      (lastMessage?.role === "Gan A" && lastMessage?.content === ""))

  if (!isLoaded) {return (<div className="absolute inset-0 flex items-center justify-center"><AnimatedOrb size={64} /></div>)}

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
        <div className={`mb-4 ${hasAnimated ? "orb-intro" : ""}`}>
          <AnimatedOrb size={128} />
        </div>

        <p className={`flex items-center gap-2 text-lg text-white font-gilroy ${hasAnimated ? "text-blur-intro" : ""}`}>
          <span>Hi, my name is Gan A</span>
          <img src={`https://cdn.coonlink.com/cloud/GanADemoChat/cherry-blossom_1f338.webp`}className="w-6 h-6"alt="🌸"/>
        </p>

        <p className={`flex items-center gap-2 mt-1 text-sm text-white font-gilroy ${hasAnimated ? "text-blur-intro-delay" : ""}`}>
          <span>Ask me anything — I’d love to hear your question</span>
          <img src={`https://cdn.coonlink.com/cloud/GanADemoChat/two-hearts_1f495.webp`}className="w-5 h-5"alt="💕"/>
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef}onScroll={handleScroll}className="absolute inset-0 overflow-y-auto pt-16 pb-32 space-y-4 border-none px-6"role="log"aria-label="Chat messages"aria-live="polite">
      {messages.filter((message) => {
          if (isStreaming && message.role === "Gan A" && message === lastMessage && message.content === "") {return false}
          return true
        }).map((message) => (<MessageBubble key={message.id}message={message}isStreaming={isStreaming && message.role === "Gan A" && message === lastMessage}/>))}
      {showTypingIndicator && <TypingIndicator />}
      <div ref={bottomRef} aria-hidden="true" className="h-20" />
    </div>
  )
}
