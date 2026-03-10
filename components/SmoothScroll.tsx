"use client"

import { useEffect } from "react"
import Lenis from "lenis"
import gsap from "gsap"

export default function SmoothScroll() {

useEffect(() => {

const lenis = new Lenis({
lerp: 0.1,
wheelMultiplier: 1,
touchMultiplier: 1,
smoothWheel: true,
syncTouch: true
})

function update(time: number) {
lenis.raf(time * 1000)
}

gsap.ticker.add(update)

return () => {
gsap.ticker.remove(update)
lenis.destroy()
}

}, [])

return null
}