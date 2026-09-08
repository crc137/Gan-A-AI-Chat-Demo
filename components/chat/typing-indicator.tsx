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

export function TypingIndicator() {
  return (
    <div className="flex gap-2 max-w-[90%] md:max-w-[80%] mr-auto items-end animate-in fade-in slide-in-from-bottom-2 duration-300"role="status"aria-label="Assistant is typing">
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0"style={{boxShadow:"rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px"}}aria-hidden="true">
        <img src="https://api.coonlink.com/v1/AvatarTg?username=Ah_Gan_bot"alt="Bot Avatar"width={32}height={32}className="w-8 h-8 rounded-full object-cover"/>
      </div>

      <div className="py-3 px-3 rounded-2xl rounded-bl-md bg-transparent">
        <div className="flex items-center gap-[5px]">
          {[0, 1, 2].map((i) => (<span key={i}className="block w-[6px] h-[6px] rounded-full bg-white/60"style={{animation: "typing-dot 1.4s ease-in-out infinite",animationDelay: `${i * 0.18}s`}}/>))}
        </div>
      </div>
    </div>
  )
}
