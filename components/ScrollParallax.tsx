"use client"

import { useEffect } from "react"

export default function ScrollParallax(){

useEffect(()=>{

const elements = document.querySelectorAll<HTMLElement>("[data-scroll-speed]")
if (elements.length === 0) return

let frameId = 0

const updateTransforms = () => {
frameId = 0

const scrollY = window.scrollY

elements.forEach((el)=>{

const speed = Number(el.dataset.scrollSpeed || 0.2)

const y = scrollY * speed

el.style.transform = `translate3d(0,${y}px,0)`

})
}

const handleScroll = () => {
if (frameId !== 0) return
frameId = window.requestAnimationFrame(updateTransforms)

}

handleScroll()
window.addEventListener("scroll",handleScroll, { passive: true })

return ()=>{
window.removeEventListener("scroll",handleScroll)
if (frameId !== 0) {
window.cancelAnimationFrame(frameId)
}
}

},[])

return null
}
