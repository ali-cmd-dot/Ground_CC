'use client'

import { useRef, useState } from 'react'
import { CheckCircle, ChevronRight } from 'lucide-react'

interface SlideToCompleteProps {
  onComplete: () => void
  disabled?: boolean
  label?: string
}

export function SlideToComplete({ onComplete, disabled, label = 'Slide to Complete' }: SlideToCompleteProps) {
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)

  const THUMB_WIDTH = 56
  const THRESHOLD = 0.85

  const getTrackWidth = () => (trackRef.current?.offsetWidth || 280) - THUMB_WIDTH

  const handleStart = (clientX: number) => {
    if (disabled || completed) return
    setDragging(true)
    startXRef.current = clientX
  }

  const handleMove = (clientX: number) => {
    if (!dragging) return
    const delta = clientX - startXRef.current
    const maxWidth = getTrackWidth()
    const newProgress = Math.max(0, Math.min(1, delta / maxWidth))
    setProgress(newProgress)
  }

  const handleEnd = () => {
    if (!dragging) return
    setDragging(false)
    if (progress >= THRESHOLD) {
      setCompleted(true)
      setProgress(1)
      setTimeout(() => { onComplete() }, 400)
    } else {
      setProgress(0)
    }
  }

  const thumbX = progress * getTrackWidth()

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        height: '56px',
        borderRadius: '16px',
        background: completed
          ? 'rgba(34,197,94,0.2)'
          : `linear-gradient(90deg, rgba(34,197,94,0.15) ${progress * 100}%, rgba(255,255,255,0.04) ${progress * 100}%)`,
        border: completed ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: disabled ? 'not-allowed' : 'grab',
        transition: completed ? 'background 0.3s' : 'none',
      }}
      onMouseMove={e => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchMove={e => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      {/* Track label */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: '600',
        color: completed ? '#4ade80' : 'rgba(255,255,255,0.35)',
        letterSpacing: '0.5px',
        paddingLeft: `${THUMB_WIDTH + 12}px`,
        transition: 'color 0.3s',
        pointerEvents: 'none',
      }}>
        {completed ? '✓ Completed!' : label}
      </div>

      {/* Thumb */}
      {!completed && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: `${4 + thumbX}px`,
            width: `${THUMB_WIDTH - 8}px`,
            height: '48px',
            borderRadius: '13px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            boxShadow: '0 4px 16px rgba(34,197,94,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: dragging ? 'none' : 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'grab',
          }}
          onMouseDown={e => { e.preventDefault(); handleStart(e.clientX) }}
          onTouchStart={e => handleStart(e.touches[0].clientX)}
        >
          {progress > 0.7
            ? <CheckCircle size={20} color="white" />
            : <ChevronRight size={20} color="white" />
          }
        </div>
      )}

      {/* Completed state */}
      {completed && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#4ade80',
          fontWeight: '700',
          fontSize: '14px',
        }}>
          <CheckCircle size={20} />
          Completed!
        </div>
      )}
    </div>
  )
}
