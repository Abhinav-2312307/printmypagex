"use client"

import { useEffect } from "react"

export default function CursorDepth(){

useEffect(()=>{

const elements = document.querySelectorAll<HTMLElement>("[data-depth]")
if (elements.length === 0) return

let frameId = 0
let latestX = 0.5
let latestY = 0.5

const updateTransforms = () => {
frameId = 0

elements.forEach((el)=>{

const depth = Number(el.dataset.depth || 20)

const moveX = (latestX - 0.5) * depth
const moveY = (latestY - 0.5) * depth

el.style.transform = `translate3d(${moveX}px,${moveY}px,0)`

})
}

const move=(e:MouseEvent)=>{

latestX = e.clientX / window.innerWidth
latestY = e.clientY / window.innerHeight

if (frameId !== 0) return
frameId = window.requestAnimationFrame(updateTransforms)

}

window.addEventListener("mousemove",move, { passive: true })

return ()=>{
window.removeEventListener("mousemove",move)
if (frameId !== 0) {
window.cancelAnimationFrame(frameId)
}
}

},[])

return null
}
