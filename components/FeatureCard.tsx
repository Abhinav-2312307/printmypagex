"use client"

import { motion } from "framer-motion"

export default function FeatureCard({
title,
desc,
direction
}:{
title:string
desc:string
direction:"left"|"right"|"bottom"
}){

const variants={
hidden:{
opacity:0,
x: direction==="left"?-120:direction==="right"?120:0,
y: direction==="bottom"?120:0
},
visible:{
opacity:1,
x:0,
y:0,
transition:{duration:0.7}
}
}

return(

<motion.div
data-depth="35"
initial="hidden"
whileInView="visible"
viewport={{once:true, margin:"-80px"}}
variants={variants}
className="group backdrop-blur-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-3xl p-8 shadow-xl transition-transform duration-500 hover:scale-[1.04]"
>

<h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
{title}
</h3>

<p className="text-gray-600 dark:text-gray-400">
{desc}
</p>

</motion.div>

)

}