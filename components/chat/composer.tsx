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

import type React from "react"
import { useState, useRef, useCallback, type KeyboardEvent, useEffect, useLayoutEffect } from "react"
import { Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { AudioWaveform } from "./audio-waveform"
import { CoonDevIcon } from "coonlink-telegramicons"

const SPEECH_LANG_RU = "ru-RU"
const SPEECH_LANG_EN = "en-US"

function resolveSpeechLang(): string {
  if (typeof navigator === "undefined") return SPEECH_LANG_RU
  const lang = navigator.language?.trim().toLowerCase() ?? ""
  if (lang.startsWith("en")) return SPEECH_LANG_EN
  if (lang.startsWith("ru")) return SPEECH_LANG_RU
  return SPEECH_LANG_RU
}
const isSpeechDebug = process.env.NODE_ENV === "development"
const MAX_MESSAGE_CHARS = 2000
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

interface ComposerProps {
  onSend: (content: string, imageData?: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function Composer({ onSend, onStop, isStreaming, disabled }: ComposerProps) {
  const [value, setValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showImageBounce, setShowImageBounce] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const baseTextRef = useRef("")
  const finalTranscriptsRef = useRef("")
  const wantRecordingRef = useRef(false)
  const handleInputRef = useRef<() => void>(() => {})

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  handleInputRef.current = handleInput

  useLayoutEffect(() => {
    if (!isRecording) return
    handleInputRef.current()
    const el = textareaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [value, isRecording])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = resolveSpeechLang()

        recognitionRef.current.onresult = (event: any) => {
          if (isSpeechDebug) console.log("speech result", event)

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            if (result.isFinal) {
              const piece = (result[0]?.transcript ?? "").trim()
              if (!piece) continue
              const prev = finalTranscriptsRef.current
              finalTranscriptsRef.current += (prev && !/\s$/.test(prev) && !/^\s/.test(piece) ? " " : "") + piece
            }
          }

          let interimTranscript = ""
          for (let i = 0; i < event.results.length; i++) {
            if (!event.results[i].isFinal) {interimTranscript += event.results[i][0]?.transcript ?? ""}
          }

          const finals = finalTranscriptsRef.current
          const base = baseTextRef.current
          const gapBaseFinal =
            base.length > 0 && finals.length > 0 && !/\s$/.test(base) && !/^\s/.test(finals) ? " " : ""
          const left = base + gapBaseFinal + finals
          const gapFinalInterim =left.length > 0 &&interimTranscript.length > 0 &&!/\s$/.test(left) &&!/^\s/.test(interimTranscript)? " ": ""

          const next = left + gapFinalInterim + interimTranscript
          if (next.length > MAX_MESSAGE_CHARS) {
            const clipped = next.slice(0, MAX_MESSAGE_CHARS)
            setValue(clipped)
            baseTextRef.current = clipped
            finalTranscriptsRef.current = ""
          } else {setValue(next)}
          queueMicrotask(() => handleInputRef.current())
        }

        recognitionRef.current.onstart = () => {if (isSpeechDebug) console.log("speech start")}

        recognitionRef.current.onerror = (event: any) => {
          if (isSpeechDebug) console.log("speech error", event.error, event)

          const code = event.error as string
          if (code === "aborted" || code === "canceled") return
          if (code === "no-speech") return

          wantRecordingRef.current = false
          setIsRecording(false)
          if (code === "not-allowed" || code === "service-not-allowed") {
            console.warn("Speech recognition: microphone or permission blocked.")
          } else {console.warn("Speech recognition:", code)}
        }

        recognitionRef.current.onend = () => {
          if (isSpeechDebug) console.log("speech end")

          if (!wantRecordingRef.current || !recognitionRef.current) {
            setIsRecording(false)
            return
          }
          queueMicrotask(() => {
            if (!wantRecordingRef.current || !recognitionRef.current) return
            try {
              recognitionRef.current.start()
            } catch (e: unknown) {
              const name = e instanceof DOMException ? e.name : (e as { name?: string })?.name
              if (name !== "InvalidStateError") {
                wantRecordingRef.current = false
                setIsRecording(false)
              }
            }
          })
        }
      }
    }

    return () => {
      wantRecordingRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  useEffect(() => {setHasAnimated(true)}, [])

  const playClickSound = useCallback(() => {
    const audio = new Audio(`https://cdn.coonlink.com/cloud/GanADemoChat/click.mp3`)
    audio.volume = 0.5
    audio.play().catch(() => {})
  }, [])

  const playRecordSound = useCallback(() => {
    const audio = new Audio(`https://cdn.coonlink.com/cloud/GanADemoChat/record.mp3`)
    audio.volume = 0.5
    audio.play().catch(() => {})
  }, [])

  const toggleRecording = useCallback(() => {
    playClickSound()

    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser")
      return
    }

    if (isRecording) {
      wantRecordingRef.current = false
      try {recognitionRef.current.stop()} catch {}
      setIsRecording(false)
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop())
        setMediaStream(null)
      }
    } else {
      playRecordSound()

      baseTextRef.current = value
      finalTranscriptsRef.current = ""
      wantRecordingRef.current = true
      recognitionRef.current.lang = resolveSpeechLang()

      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          setMediaStream(stream)

          try {
            recognitionRef.current.start()
            setIsRecording(true)
          } catch (e: unknown) {
            const name = e instanceof DOMException ? e.name : (e as { name?: string })?.name
            if (name === "InvalidStateError") {
              setIsRecording(true)
              return
            }
            console.error(e)
            stream.getTracks().forEach((track) => track.stop())
            setMediaStream(null)
            wantRecordingRef.current = false
            setIsRecording(false)
          }
        }).catch((err) => {
          console.error("Microphone:", err)
          wantRecordingRef.current = false
          setIsRecording(false)
        })
    }
  }, [isRecording, value, playClickSound, playRecordSound, mediaStream])

  const handleSend = useCallback(() => {
    if ((!value.trim() && !uploadedImage) || isStreaming || disabled) return
    playClickSound()

    if (isRecording && recognitionRef.current) {
      wantRecordingRef.current = false
      try {
        recognitionRef.current.stop()
      } catch {}
      setIsRecording(false)
    }
    if (isRecording && mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      setMediaStream(null)
    }
    onSend(value || "Describe this image", uploadedImage || undefined)
    setValue("")
    setUploadedImage(null)
    baseTextRef.current = ""
    finalTranscriptsRef.current = ""
    if (textareaRef.current) {textareaRef.current.style.height = "auto"}
  }, [value, uploadedImage, isStreaming, disabled, onSend, isRecording, mediaStream, playClickSound])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      playClickSound()
      setUploadError(null)

      const file = e.target.files?.[0]
      if (file) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {setUploadError("JPEG, PNG, WebP, GIF only")} else if (file.size > MAX_IMAGE_BYTES) {setUploadError("No more than 2 MB")} else {
          const reader = new FileReader()
          reader.onload = (event) => {
            setUploadedImage(event.target?.result as string)
            setShowImageBounce(true)
            setTimeout(() => setShowImageBounce(false), 400)
          }
          reader.readAsDataURL(file)
        }
      }
      e.target.value = ""
    },
    [playClickSound],
  )

  const removeImage = useCallback(() => {setUploadedImage(null)}, [])

  return (
    <div className={cn("fixed left-0 right-0 px-4 pointer-events-none z-10",hasAnimated ? "composer-intro" : "bottom-4")}>
      <div className="relative max-w-2xl mx-auto pointer-events-auto">
        <div className={cn("flex flex-col gap-3 p-4 bg-white border-stone-200 transition-[box-shadow,border-color] duration-200 border-none border-0 overflow-hidden relative rounded-3xl","focus-within:border-stone-300 focus-within:ring-2 focus-within:ring-stone-200 mui-mirror")}style={{boxShadow:"rgba(14, 63, 126, 0.06) 0px 0px 0px 1px, rgba(42, 51, 69, 0.06) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.06) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.06) 0px 6px 6px -3px, rgba(14, 63, 126, 0.06) 0px 12px 12px -6px, rgba(14, 63, 126, 0.06) 0px 24px 24px -12px",}}>
          <div className="flex gap-2 items-center">
            {uploadedImage && (
              <div className={cn("relative shrink-0", showImageBounce && "image-bounce")}>
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200"><Image src={uploadedImage || "/placeholder.svg"}alt="Uploaded image"width={48}height={48}className="w-full h-full object-cover"/></div>
                <button onClick={removeImage}className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-800 hover:bg-stone-900 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"aria-label="Remove image"><X className="w-3 h-3" /></button>
              </div>
            )}

            <div className="composer-textarea-shell relative min-w-0 flex-1 max-h-[200px] overflow-hidden rounded-xl">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value.slice(0, MAX_MESSAGE_CHARS))
                  handleInput()
                }}onKeyDown={handleKeyDown}placeholder={isRecording ? "Listening..." : "Type a message... (Shift+Enter for new line)"}disabled={isStreaming || disabled}rows={1}maxLength={MAX_MESSAGE_CHARS}className={cn("composer-textarea-scroll relative z-[1] w-full min-h-[36px] max-h-[200px] resize-none overflow-y-auto overflow-x-hidden rounded-xl","bg-transparent px-2 py-1.5 text-sm text-white/50 placeholder:text-stone-400","focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-gilroy")}aria-label="Message input"/>
            </div>

            {isRecording && (<div className="shrink-0 w-24"><AudioWaveform isRecording={isRecording} stream={mediaStream} /></div>)}

            {isStreaming ? (
              <button
                onClick={() => {
                  playClickSound()
                  onStop()
                }}className="relative h-9 w-9 shrink-0 transition-all rounded-full flex items-center justify-center cursor-pointer hover:scale-105 cursor-pointer"aria-label="Stop generating">
                <Square className="w-5 h-5 absolute drop-shadow-md text-red-700"fill="currentColor"aria-hidden="true"/>
              </button>
            ) : (<button onClick={handleSend}disabled={(!value.trim() && !uploadedImage) || disabled}className={cn("relative h-9 w-9 shrink-0 transition-all rounded-full flex items-center justify-center",(!value.trim() && !uploadedImage) || disabled? "opacity-50 cursor-not-allowed": "hover:scale-105 cursor-pointer")}style={{borderColor: "#ffffff26",backgroundColor: "#ffffff1a",color: "#ffffff"}}aria-label="Send message"><CoonDevIcon.I000208 className="h-[1.1rem] w-[1.1rem]" /></button>)}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef}type="file"accept="image/jpeg,image/png,image/webp,image/gif"onChange={handleFileSelect}className="hidden"aria-label="Upload image"/>
              <Button onClick={toggleRecording}disabled={isStreaming || disabled}variant="ghost"size="icon"className="h-9 w-9 shrink-0 rounded-full cursor-pointer"style={{borderColor: "#ffffff26",backgroundColor: isRecording ? "#ef4444" : "#ffffff1a",color: "#ffffff"}}aria-label={isRecording ? "Stop recording" : "Start voice input"}><CoonDevIcon.I232300 className="w-5 h-5" /></Button>
              <Button onClick={() => {playClickSound();fileInputRef.current?.click()}}disabled={isStreaming || disabled}variant="ghost"size="icon"className="h-9 w-9 shrink-0 rounded-full cursor-pointer"style={{borderColor: "#ffffff26",backgroundColor: "#ffffff1a",color: "#ffffff"}}aria-label="Attach image"><CoonDevIcon.I003512 className="w-5 h-5" /></Button>
              {uploadError && (<span className="text-[11px] text-red-400/90 font-gilroy">{uploadError}</span>)}
            </div>

            <p className={cn("text-[11px] tabular-nums px-1 font-gilroy shrink-0",value.length >= MAX_MESSAGE_CHARS ? "text-amber-400/90" : "text-white/35")}aria-live="polite">{value.length} / {MAX_MESSAGE_CHARS}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
