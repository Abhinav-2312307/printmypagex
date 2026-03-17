"use client"

import { useEffect } from "react"
import Lenis from "lenis"

export default function SmoothScroll() {

useEffect(() => {

const lenis = new Lenis({
lerp: 0.1,
wheelMultiplier: 1,
touchMultiplier: 1,
smoothWheel: true,
syncTouch: true
})

let frameId = 0

const update = (time: number) => {
lenis.raf(time)
frameId = window.requestAnimationFrame(update)
}

frameId = window.requestAnimationFrame(update)

return () => {
window.cancelAnimationFrame(frameId)
lenis.destroy()
}

}, [])

return null
}
