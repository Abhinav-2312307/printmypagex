"use client"

import { useState } from "react"
import { Linkedin, Github, Globe } from "lucide-react"

export default function CreatorFooter(){

const [hover,setHover] = useState(false)
const [open,setOpen] = useState(false)

const visible = hover || open

return(

<div className="relative flex justify-center">

<p className="text-gray-500 text-sm">

Made with ❤️ by{" "}

<span
onMouseEnter={()=>setHover(true)}
onMouseLeave={()=>setHover(false)}
onClick={()=>setOpen(!open)}
className="
cursor-pointer
font-semibold
bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400
bg-clip-text text-transparent
hover:brightness-125
transition-all duration-300
hover:scale-110
hover:-translate-y-[1px]
inline-block
"
>

Abhinav Sahu

</span>

</p>


{/* Profile popup */}

{visible &&(

<div
onMouseEnter={()=>setHover(true)}
onMouseLeave={()=>setHover(false)}
className="
absolute bottom-10
backdrop-blur-2xl
bg-white/80 dark:bg-white/5
border border-gray-200 dark:border-white/10
shadow-[0_20px_60px_rgba(0,0,0,0.4)]
rounded-2xl
p-6
w-[300px]
text-center
transition-all duration-300
ease-[cubic-bezier(.34,1.56,.64,1)]
scale-100
"
>

<h3 className="text-lg font-semibold">
Abhinav Sahu
</h3>

<p className="text-sm text-gray-500 mb-3">
Full-Stack Developer • AI Enthusiast • PSIT
</p>

<div className="text-sm text-gray-500 space-y-1">

<p>Creator of PrintMyPage</p>
<p>Creator of JusticeAlly</p>
<p>GDGoC Challenge Rank #1</p>
<p>Always eager to learn and innovate!</p>

</div>


{/* SOCIAL ICON BUTTONS */}

<div className="flex justify-center gap-4 mt-5">

<a
href="https://www.linkedin.com/in/abhinav-sahu-865a01297/"
target="_blank"
className="
w-10 h-10
flex items-center justify-center
rounded-full
border border-gray-300 dark:border-white/20
backdrop-blur-xl
transition-all duration-300
hover:scale-110
hover:-translate-y-[2px]
hover:bg-indigo-500 hover:text-white
hover:shadow-[0_6px_20px_rgba(80,120,255,0.35)]
"
>

<Linkedin size={18}/>

</a>


<a
href="https://portfolio-abhinavsahu.vercel.app/"
target="_blank"
className="
w-10 h-10
flex items-center justify-center
rounded-full
border border-gray-300 dark:border-white/20
backdrop-blur-xl
transition-all duration-300
hover:scale-110
hover:-translate-y-[2px]
hover:bg-cyan-500 hover:text-white
hover:shadow-[0_6px_20px_rgba(80,120,255,0.35)]
"
>

<Globe size={18}/>

</a>


<a
href="https://github.com/Abhinav-2312307"
target="_blank"
className="
w-10 h-10
flex items-center justify-center
rounded-full
border border-gray-300 dark:border-white/20
backdrop-blur-xl
transition-all duration-300
hover:scale-110
hover:-translate-y-[2px]
hover:bg-gray-900 hover:text-white
hover:shadow-[0_6px_20px_rgba(80,120,255,0.35)]
"
>

<Github size={18}/>

</a>

</div>

</div>

)}

</div>

)
}