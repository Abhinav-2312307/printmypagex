"use client"

import { useEffect, useRef } from "react"

const steps = [
"Create Order",
"Order Accepted",
"Payment",
"Printing Starts",
"Delivered"
]

export default function FlowTimeline(){

const canvasRef = useRef<HTMLCanvasElement>(null)

useEffect(()=>{

const canvas = canvasRef.current!
const ctx = canvas.getContext("2d")!

let width = canvas.offsetWidth
let height = canvas.offsetHeight

canvas.width = width
canvas.height = height

const segments = 40
const ropeLength = width*0.8

const points:any[] = []
const prev:any[] = []

for(let i=0;i<=segments;i++){

const x = width*0.1 + (i/segments)*ropeLength
const y = height/2

points.push({x,y})
prev.push({x,y})

}

const gravity = 0.12
const friction = 0.999

let mouse = {x:0,y:0,active:false}

canvas.addEventListener("mousemove",(e)=>{
const rect = canvas.getBoundingClientRect()
mouse.x = e.clientX - rect.left
mouse.y = e.clientY - rect.top
mouse.active=true
})

canvas.addEventListener("mouseleave",()=>{
mouse.active=false
})

function update(){

for(let i=1;i<points.length;i++){

let p = points[i]
let pr = prev[i]

let vx = (p.x-pr.x)*friction
let vy = (p.y-pr.y)*friction

prev[i] = {x:p.x,y:p.y}

p.x += vx
p.y += vy + gravity

if(mouse.active){

let dx = p.x-mouse.x
let dy = p.y-mouse.y
let dist = Math.sqrt(dx*dx+dy*dy)

if(dist<80){

p.x += dx*0.03
p.y += dy*0.03

}

}

}

points[0].x = width*0.1
points[0].y = height/2

points[segments].x = width*0.9
points[segments].y = height/2

for(let k=0;k<6;k++){

for(let i=0;i<segments;i++){

let p1 = points[i]
let p2 = points[i+1]

let dx = p2.x-p1.x
let dy = p2.y-p1.y

let dist = Math.sqrt(dx*dx+dy*dy)

let diff = (dist-(ropeLength/segments))/dist

let offX = dx*0.5*diff
let offY = dy*0.5*diff

if(i!==0){
p1.x += offX
p1.y += offY
}

if(i+1!==segments){
p2.x -= offX
p2.y -= offY
}

}

}

}

function draw(){

ctx.clearRect(0,0,width,height)

ctx.beginPath()

ctx.moveTo(points[0].x,points[0].y)

for(let i=1;i<points.length;i++){

ctx.lineTo(points[i].x,points[i].y)

}

ctx.strokeStyle="rgba(180,180,200,0.7)"
ctx.lineWidth=3
ctx.stroke()

}

function animate(){

update()
draw()
requestAnimationFrame(animate)

}

animate()

},[])

return(

<section className="py-32">

<h2 className="text-4xl font-bold text-center mb-20">
How Printing Works
</h2>

<div className="relative max-w-6xl mx-auto">

<canvas
ref={canvasRef}
className="w-full h-[200px]"
/>

<div className="absolute top-[70px] w-full flex justify-between px-[10%]">

{steps.map((step,i)=>(
<div
key={i}
className="backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl px-6 py-3 shadow-lg text-sm"
>
{step}
</div>
))}

</div>

</div>

</section>

)

}