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

import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ToastProvider } from "@/components/toast-provider"
import "./globals.css"
import 'goey-toast/styles.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {title: "Gan A · AI Chat Demo",description: "A soft, friendly AI assistant — ask me anything ✨",icons: {icon: [{url: "https://api.coonlink.com/v1/AvatarTg?username=Ah_Gan_bot",type: "image/jpeg"}]}}
export const viewport: Viewport = {themeColor: "#fafaf9",width: "device-width",initialScale: 1,maximumScale: 1,userScalable: false}
export default function RootLayout({children,}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <head>
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanAApp/Fonts/Gilroy-ExtraBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanAApp/Fonts/Gilroy-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanAApp/Fonts/Gilroy-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanAApp/Fonts/PhonkSans-Black.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanAApp/Fonts/HansonBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanAApp/Fonts/Virgil.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanADemoChat/Mirror.jpeg" as="image" />
      <link rel="preload" href="https://cdn.coonlink.com/cloud/GanADemoChat/Mirror.o.jpeg" as="image" />
      <style>{`.gooey-description {color: #ffffff80}.gooey-wrapper[data-theme=light] .gooey-progressError {background: rgb(135, 35, 52)}.gooey-wrapper[data-theme=light] .gooey-titleError {color: rgb(180, 47, 70)}.gooey-timestamp {display: none}.gooey-blobSvg path {fill: #1c1c2061}.mui-mirror {position: relative;overflow: hidden;isolation: isolate;transform: translateZ(0);-webkit-transform: translateZ(0);will-change: backdrop-filter, transform;-webkit-backdrop-filter: url(#glass-distortion-large) blur(.22rem);backdrop-filter: url(#glass-distortion-large) blur(.22rem);background: rgba(28, 28, 32, .38);box-shadow: rgba(255, 255, 255, .4) .063rem .063rem .063rem 0 inset}.mui-mirror::before {content: "";position: absolute;z-index: -1;inset: 0;border-radius: inherit;padding: .063rem;background: linear-gradient(90deg, rgba(46, 55, 88, .4) 20%, rgba(244, 174, 146, .24) 80%);mask: linear-gradient(rgb(255, 255, 255) 0px, rgb(255, 255, 255) 0) content-box exclude, linear-gradient(rgb(255, 255, 255) 0, rgb(255, 255, 255) 0);pointer-events: none}.gooey-wrapper {backdrop-filter: url(#glass-distortion-large) blur(.188rem) !important;-webkit-backdrop-filter: url(#glass-distortion-large) blur(.188rem) !important}`}</style>
      </head>
      <body className={`antialiased font-gilroy`}>
      {children}
      <ToastProvider />
      <Analytics />
      <svg width={0} height={0} style={{ display: "none" }} aria-hidden="true">
        <defs>
          <filter colorInterpolationFilters="sRGB" id="glass-distortion-large" x="0%" y="0%" width="100%" height="100%">
            <feImage preserveAspectRatio="none" href="https://cdn.coonlink.com/cloud/GanADemoChat/Mirror.jpeg" result="map_body" />
            <feTurbulence type="fractalNoise" baseFrequency="0.045 0.07" numOctaves="2" seed="23" stitchTiles="stitch" result="map_fine" />
            <feDisplacementMap in="SourceGraphic" in2="map_body" scale="118" xChannelSelector="R" yChannelSelector="G" result="coarse" />
            <feDisplacementMap in="coarse" in2="map_fine" scale="16" xChannelSelector="R" yChannelSelector="G" result="rippled" />
            <feGaussianBlur in="rippled" stdDeviation="0.35" result="displaced" />
          </filter>
          <filter colorInterpolationFilters="sRGB" id="round-glass-distortion-small" x="0%" y="0%" width="100%" height="100%">
            <feImage preserveAspectRatio="none" href="https://cdn.coonlink.com/cloud/GanADemoChat/Mirror.o.jpeg" result="map_body" />
            <feTurbulence type="fractalNoise" baseFrequency="0.055 0.09" numOctaves="2" seed="41" stitchTiles="stitch" result="map_fine" />
            <feDisplacementMap in="SourceGraphic" in2="map_body" scale="112" xChannelSelector="R" yChannelSelector="G" result="coarse" />
            <feDisplacementMap in="coarse" in2="map_fine" scale="14" xChannelSelector="R" yChannelSelector="G" result="rippled" />
            <feGaussianBlur in="rippled" stdDeviation="0.3" result="displaced" />
          </filter>
          <filter id="glass-distortion" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.004" numOctaves="5" seed="30" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="40" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </body>
  </html>
  )
}
