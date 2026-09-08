"use client"

import { GooeyToaster } from "goey-toast"

export function ToastProvider() {
  return (
    <>
      <svg width="0" height="0" style={{ display: "none" }} aria-hidden="true">
        <defs>
          <filter id="gooey-glass" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.004" numOctaves="5" seed="30" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="40" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <GooeyToaster position="top-center" theme="light" preset="smooth" />
    </>
  )
}
