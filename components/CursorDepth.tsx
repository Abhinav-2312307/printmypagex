"use client"

import { useEffect } from "react"

export default function CursorDepth(){

useEffect(()=>{

const elements=document.querySelectorAll("[data-depth]")

const move=(e:MouseEvent)=>{

const x=e.clientX/window.innerWidth
const y=e.clientY/window.innerHeight

elements.forEach((el:any)=>{

const depth=el.dataset.depth || 20

const moveX=(x-0.5)*depth
const moveY=(y-0.5)*depth

el.style.transform=`translate3d(${moveX}px,${moveY}px,0)`

})

}

window.addEventListener("mousemove",move)

return ()=>{
window.removeEventListener("mousemove",move)
}

},[])

return null
}