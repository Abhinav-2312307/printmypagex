"use client"

import { motion } from "framer-motion"
import { useState, type ReactNode } from "react"

type LiquidGlassPanelProps = {
  children: ReactNode
  className?: string
}

export default function LiquidGlassPanel({
  children,
  className = ""
}: LiquidGlassPanelProps) {
  const [pointer, setPointer] = useState({ x: 52, y: 48 })

  return (
    <motion.div
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * 100
        const y = ((event.clientY - rect.top) / rect.height) * 100

        setPointer({
          x: Number.isFinite(x) ? x : 52,
          y: Number.isFinite(y) ? y : 48
        })
      }}
      onPointerLeave={() => setPointer({ x: 52, y: 48 })}
      whileHover={{ y: -8, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 180, damping: 18, mass: 0.7 }}
      className={`group relative overflow-hidden rounded-[2rem] border border-white/40 dark:border-white/10 bg-white/65 dark:bg-white/5 backdrop-blur-3xl shadow-[0_24px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_24px_70px_rgba(2,8,23,0.36)] ${className}`}
      style={{
        transformPerspective: 1200
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
        style={{
          background: `
            radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(255,255,255,0.14), transparent 22%),
            radial-gradient(circle at ${Math.min(pointer.x + 16, 100)}% ${Math.max(pointer.y - 8, 0)}%, rgba(125,211,252,0.08), transparent 24%),
            radial-gradient(circle at ${100 - pointer.x}% 18%, rgba(99,102,241,0.08), transparent 26%),
            linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))
          `
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/4 via-transparent to-slate-950/8 opacity-70" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-20 rounded-full bg-white/14 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-10 h-28 w-28 rounded-full bg-cyan-300/8 blur-3xl transition duration-500 group-hover:scale-125" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-indigo-300/10 blur-3xl transition duration-500 group-hover:scale-125" />
      <div className="liquid-grid pointer-events-none absolute inset-0 opacity-28" />

      <div className="relative">{children}</div>
    </motion.div>
  )
}
