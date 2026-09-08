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

import { cn } from "@/lib/utils"
import type { Message } from "./chat-shell"
import { MarkdownRenderer } from "./markdown-renderer"
import Image from "next/image"

const username = "CoonDev_bot"

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

function formatTime(date: Date): string {return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex max-w-[90%] md:max-w-[80%] gap-2",isUser? "ml-auto flex-row-reverse": "mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300 items-end")}>
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white",isUser && "user-message-enter-avatar",!isUser && isStreaming && "sticky bottom-4 self-end transition-[transform,opacity] duration-300")} style={{boxShadow:"rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px"}} aria-hidden="true">
        {isUser ? (<img src={`https://api.coonlink.com/v1/AvatarTg?username=${encodeURIComponent(username || "")}`}alt="User Avatar"width={32}height={32}className="w-8 h-8 rounded-full object-cover"/>) : (<img src={`https://api.coonlink.com/v1/AvatarTg?username=Ah_Gan_bot`}alt="Bot Avatar"width={32}height={32}className="w-8 h-8 shrink-0 rounded-full object-cover"/>)}
      </div>

      <div className={cn("flex flex-col",isUser ? "items-end user-message-enter-bubble" : "items-start")}>
        <span className="text-xs text-white font-bold font-gilroy mb-1 hidden sm:block mt-2">{isUser ? "You" : "Gan A"}</span>

        <div className={cn("rounded-2xl border-none overflow-hidden",isUser? "bg-black text-white mui-mirror border border-stone-200 rounded-br-md": "bg-transparent text-white/50 rounded-bl-md",isUser && message.imageData ? "max-w-[280px] w-[280px]" : "")}style={{boxShadow: isUser? "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px": "none",willChange: isStreaming ? "height" : undefined,transition:"max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)"}}>
          <div className={cn(isUser ? (message.imageData ? "" : "px-4 py-3") : "py-1")}style={{transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease"}}>
            {isUser ? (
              message.imageData ? (
                <div className="flex flex-col">
                  <Image src={message.imageData}alt="Uploaded image"width={280}height={220}className="w-[280px] object-cover image-bounce"style={{ maxHeight: 200 }}unoptimized/>
                  {message.content && (<p className="text-sm whitespace-pre-wrap break-words font-gilroy px-4 pt-2 pb-3">{message.content}</p>)}
                </div>
              ) : (<p className="text-sm whitespace-pre-wrap break-words font-gilroy">{message.content}</p>)
            ) : (<MarkdownRenderer content={message.content || " "} isStreaming={isStreaming} />)}
          </div>
        </div>

        {!isUser && !isStreaming && message.content.includes("t.coonlink.com/Ah_Gan_bot") && (
          <a href="https://t.coonlink.com/Ah_Gan_bot?startgroup=hbase"target="_blank"rel="noopener noreferrer"className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-gilroy font-semibold transition-opacity hover:opacity-85 w-fit"style={{ background: "linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)" }}>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Add Gan A to your group
          </a>
        )}
        <span className="text-xs text-stone-400 mt-1 font-gilroy">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  )
}
