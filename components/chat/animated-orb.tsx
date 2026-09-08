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

export function AnimatedOrb({size = 32}: { className?: string; variant?: "default" | "red"; size?: number }) {

  return (
    <div className="flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-transparent px-2 py-1">
    <div className={`relative rounded-full overflow-hidden object-cover shadow-sm border border-white/20`}style={{width: size,height: size,background: `url("https://api.coonlink.com/v1/AvatarTg?username=Ah_Gan_bot") center center / cover no-repeat`,boxShadow: "rgba(17, 12, 46, 0.15) 0px 48px 100px 0px"}}/>
    </div>
  )
}
