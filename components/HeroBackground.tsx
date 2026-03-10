"use client"

export default function HeroBackground() {

return (

<div className="absolute inset-0 overflow-hidden pointer-events-none">

{/* left glow */}
<div
data-depth="60"
className="absolute w-[520px] h-[520px]
bg-indigo-500/20
blur-[120px]
rounded-full
top-[-180px]
left-[8%]
transform-gpu"
/>

{/* right glow */}
<div
data-depth="80"
className="absolute w-[520px] h-[520px]
bg-cyan-500/20
blur-[120px]
rounded-full
bottom-[-220px]
right-[8%]
transform-gpu"
/>

</div>

)

}