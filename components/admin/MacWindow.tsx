"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"

type WindowMode = "drag" | "resize"

type WindowRect = {
  left: number
  top: number
  width: number
  height: number
}

type DragState = {
  offsetX: number
  offsetY: number
}

type ResizeState = {
  startX: number
  startY: number
  width: number
  height: number
}

type MacWindowProps = {
  title: string
  subtitle?: string
  zIndex?: number
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
  mode: WindowMode
  onModeChange: (mode: WindowMode) => void
  onClose: () => void
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}

const WINDOW_MARGIN = 14

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function MacWindow({
  title,
  subtitle = "",
  zIndex = 120,
  initialWidth = 860,
  initialHeight = 620,
  minWidth = 420,
  minHeight = 320,
  mode,
  onModeChange,
  onClose,
  children,
  className = "",
  bodyClassName = ""
}: MacWindowProps) {
  const [mounted, setMounted] = useState(false)

  const [rect, setRect] = useState<WindowRect>({
    left: WINDOW_MARGIN,
    top: WINDOW_MARGIN,
    width: initialWidth,
    height: initialHeight
  })

  const [maximized, setMaximized] = useState(false)
  const [savedRect, setSavedRect] = useState<WindowRect | null>(null)

  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const clampRect = useCallback(
    (next: WindowRect): WindowRect => {
      if (typeof window === "undefined") return next

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const width = clamp(next.width, minWidth, Math.max(minWidth, viewportWidth - WINDOW_MARGIN * 2))
      const height = clamp(next.height, minHeight, Math.max(minHeight, viewportHeight - WINDOW_MARGIN * 2))
      const left = clamp(next.left, WINDOW_MARGIN, Math.max(WINDOW_MARGIN, viewportWidth - width - WINDOW_MARGIN))
      const top = clamp(next.top, WINDOW_MARGIN, Math.max(WINDOW_MARGIN, viewportHeight - height - WINDOW_MARGIN))

      return { left, top, width, height }
    },
    [minHeight, minWidth]
  )

  const centerWindow = useCallback(() => {
    if (typeof window === "undefined") return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const width = clamp(initialWidth, minWidth, Math.max(minWidth, viewportWidth - WINDOW_MARGIN * 2))
    const height = clamp(initialHeight, minHeight, Math.max(minHeight, viewportHeight - WINDOW_MARGIN * 2))

    const left = Math.max(WINDOW_MARGIN, Math.round((viewportWidth - width) / 2))
    const top = Math.max(WINDOW_MARGIN, Math.round((viewportHeight - height) / 2))

    setRect({ left, top, width, height })
  }, [initialHeight, initialWidth, minHeight, minWidth])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true)
      centerWindow()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [centerWindow])

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return

    const handleResize = () => {
      if (maximized) {
        setRect({
          left: WINDOW_MARGIN,
          top: WINDOW_MARGIN,
          width: Math.max(minWidth, window.innerWidth - WINDOW_MARGIN * 2),
          height: Math.max(minHeight, window.innerHeight - WINDOW_MARGIN * 2)
        })
        return
      }

      setRect((prev) => clampRect(prev))
    }

    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [clampRect, maximized, minHeight, minWidth, mounted])

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (dragRef.current && mode === "drag" && !maximized) {
        const left = event.clientX - dragRef.current.offsetX
        const top = event.clientY - dragRef.current.offsetY
        setRect((prev) => clampRect({ ...prev, left, top }))
        return
      }

      if (resizeRef.current && mode === "resize" && !maximized) {
        const deltaX = event.clientX - resizeRef.current.startX
        const deltaY = event.clientY - resizeRef.current.startY

        const width = resizeRef.current.width + deltaX
        const height = resizeRef.current.height + deltaY

        setRect((prev) => clampRect({ ...prev, width, height }))
      }
    }

    const handleUp = () => {
      dragRef.current = null
      resizeRef.current = null
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)

    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [clampRect, maximized, mode])

  const onStartDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "drag" || maximized) return
    dragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    }
  }

  const onStartResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (mode !== "resize" || maximized) return
    event.preventDefault()
    event.stopPropagation()

    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height
    }
  }

  const toggleMaximize = () => {
    if (typeof window === "undefined") return

    if (!maximized) {
      setSavedRect(rect)
      setRect({
        left: WINDOW_MARGIN,
        top: WINDOW_MARGIN,
        width: Math.max(minWidth, window.innerWidth - WINDOW_MARGIN * 2),
        height: Math.max(minHeight, window.innerHeight - WINDOW_MARGIN * 2)
      })
      setMaximized(true)
      return
    }

    if (savedRect) {
      setRect(clampRect(savedRect))
    }
    setMaximized(false)
  }

  const headerCursor = mode === "drag" && !maximized ? "cursor-move" : "cursor-default"

  const computedStyle = useMemo(
    () => ({
      zIndex,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    }),
    [rect.height, rect.left, rect.top, rect.width, zIndex]
  )

  return (
    <div
      className={`fixed rounded-3xl border border-gray-200 dark:border-white/20 bg-white/90 dark:bg-black/82 backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden ${className}`}
      style={computedStyle}
    >
      <div
        onMouseDown={onStartDrag}
        className={`h-14 border-b border-gray-200 dark:border-white/10 px-4 flex items-center justify-between bg-gradient-to-r from-white/80 to-gray-100/50 dark:from-white/10 dark:to-white/5 select-none ${headerCursor}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2" onMouseDown={(event) => event.stopPropagation()}>
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-rose-500 hover:brightness-110 transition"
              aria-label="Close window"
            />
            <button
              onClick={centerWindow}
              className="w-3 h-3 rounded-full bg-amber-400 hover:brightness-110 transition"
              aria-label="Center window"
            />
            <button
              onClick={toggleMaximize}
              className="w-3 h-3 rounded-full bg-emerald-400 hover:brightness-110 transition"
              aria-label="Toggle maximize"
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-indigo-500 dark:text-cyan-300">{title}</p>
            {subtitle ? <p className="text-[11px] text-gray-600 dark:text-gray-300">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2" onMouseDown={(event) => event.stopPropagation()}>
          <div className="inline-flex rounded-full border border-gray-200 dark:border-white/20 overflow-hidden text-xs">
            <button
              onClick={() => onModeChange("drag")}
              className={`px-2.5 py-1 ${mode === "drag" ? "bg-indigo-500 text-white" : "bg-white/80 dark:bg-white/5"}`}
            >
              Drag
            </button>
            <button
              onClick={() => onModeChange("resize")}
              className={`px-2.5 py-1 ${mode === "resize" ? "bg-indigo-500 text-white" : "bg-white/80 dark:bg-white/5"}`}
            >
              Resize
            </button>
          </div>

          <button
            onClick={toggleMaximize}
            className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center justify-center"
            aria-label="Toggle maximize state"
          >
            {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className={`h-[calc(100%-3.5rem)] overflow-auto p-4 ${bodyClassName}`}>{children}</div>

      {mode === "resize" && !maximized ? (
        <button
          onMouseDown={onStartResize}
          className="absolute bottom-2 right-2 w-6 h-6 rounded-md border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/10 flex items-center justify-center cursor-se-resize"
          aria-label="Resize window"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300" fill="none">
            <path d="M5 15H15V5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 15H15V9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
