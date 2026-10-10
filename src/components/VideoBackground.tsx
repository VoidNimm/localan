import React, { useEffect, useRef, useState } from 'react'

export type AppPhase = 'landing' | 'transitioning' | 'chat'

interface VideoBackgroundProps {
  phase: AppPhase
  isModalOpen?: boolean
  onTransitionReadyForChat?: () => void
  onTransitionComplete?: () => void
  onVideo1Ready?: () => void
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  phase,
  isModalOpen = false,
  onTransitionReadyForChat,
  onTransitionComplete,
  onVideo1Ready,
}) => {
  const video1Ref = useRef<HTMLVideoElement>(null)
  const video2Ref = useRef<HTMLVideoElement>(null)

  const [v1Loaded, setV1Loaded] = useState(false)
  const [v2Loaded, setV2Loaded] = useState(false)
  const [v1Error, setV1Error] = useState(false)
  const [isCrossfadingToV2, setIsCrossfadingToV2] = useState(false)
  const [isCrossfadingToStatic, setIsCrossfadingToStatic] = useState(false)
  const [unmountedVideos, setUnmountedVideos] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  // Detect prefers-reduced-motion changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Energy saving: Pause video1 when tab is hidden or modal is open
  useEffect(() => {
    if (phase === 'landing' && video1Ref.current) {
      if (document.hidden || isModalOpen) {
        video1Ref.current.pause()
      } else {
        video1Ref.current.play().catch(() => {})
      }
    }
  }, [phase, isModalOpen])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (phase === 'landing' && video1Ref.current) {
        if (document.hidden || isModalOpen) {
          video1Ref.current.pause()
        } else {
          video1Ref.current.play().catch(() => {})
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [phase, isModalOpen])

  // Handle transition when phase changes to 'transitioning'
  useEffect(() => {
    if (phase === 'transitioning') {
      const scheduleTimer = setTimeout(() => {
        // Edge case 1: prefers-reduced-motion (no video playback, immediate fade to static)
        if (reducedMotion) {
          setIsCrossfadingToStatic(true)
          onTransitionReadyForChat?.()
          setTimeout(() => {
            setUnmountedVideos(true)
            onTransitionComplete?.()
          }, 500)
          return
        }

        // Edge case 2: video2 not ready or video error (skip video2, fade directly to static dark)
        if (!v2Loaded || v1Error || !video2Ref.current) {
          setIsCrossfadingToStatic(true)
          onTransitionReadyForChat?.()
          setTimeout(() => {
            setUnmountedVideos(true)
            onTransitionComplete?.()
          }, 600)
          return
        }

        // Normal flow: Video1 dissolves into Video2 with 400ms crossfade
        setIsCrossfadingToV2(true)
        const v2 = video2Ref.current
        v2.currentTime = 0
        // Accelerate video2 (playbackRate = 4.0) so the 8.0s timelapse plays in ~2s
        v2.playbackRate = 4.0
        v2.play().catch(() => {
          setIsCrossfadingToStatic(true)
        })

        // Layout shifts and streaming starts at 400ms (as soon as layout shift begins),
        // without waiting for video2 to end!
        setTimeout(() => {
          onTransitionReadyForChat?.()
        }, 400)

        // Monitor playback: at ~6.0s video time (~2.0s real time), begin 600ms crossfade to #140a07
        const handleTimeUpdate = () => {
          if (v2.currentTime >= 6.0) {
            v2.removeEventListener('timeupdate', handleTimeUpdate)
            setIsCrossfadingToStatic(true)
            setTimeout(() => {
              setUnmountedVideos(true)
              onTransitionComplete?.()
            }, 600)
          }
        }

        v2.addEventListener('timeupdate', handleTimeUpdate)
        v2.onended = () => {
          setIsCrossfadingToStatic(true)
          setTimeout(() => {
            setUnmountedVideos(true)
            onTransitionComplete?.()
          }, 600)
        }
      }, 0)

      return () => clearTimeout(scheduleTimer)
    } else if (phase === 'landing') {
      // Returning from chat to landing (New Chat clicked)
      const resetTimer = setTimeout(() => {
        setUnmountedVideos(false)
        setIsCrossfadingToV2(false)
        setIsCrossfadingToStatic(false)
        if (video1Ref.current && !reducedMotion) {
          video1Ref.current.currentTime = 0
          video1Ref.current.play().catch(() => {})
        }
      }, 0)
      return () => clearTimeout(resetTimer)
    }
  }, [phase, v2Loaded, v1Error, reducedMotion, onTransitionReadyForChat, onTransitionComplete])

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none pointer-events-none"
      style={{
        zIndex: 0,
        backgroundColor: '#140a07',
      }}
      aria-hidden="true"
    >
      {/* Layer A: Poster / Fallback Image (background.jpg) */}
      <img
        src="/assets/background.jpg"
        alt=""
        className={`absolute inset-0 w-full h-full object-cover object-[center_60%] transition-opacity duration-700 ease-out ${
          isCrossfadingToStatic ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Layer B & C: Videos (only mounted when not in permanent chat mode) */}
      {!unmountedVideos && !reducedMotion && (
        <>
          {/* Layer B: Video1 (Landing Loop) */}
          <video
            ref={video1Ref}
            src="/assets/video1.mp4"
            autoPlay
            muted
            loop
            playsInline
            onCanPlay={() => {
              setV1Loaded(true)
              onVideo1Ready?.()
            }}
            onError={() => {
              setV1Error(true)
              onVideo1Ready?.() // still trigger UI reveal on poster
            }}
            className={`absolute inset-0 w-full h-full object-cover object-[center_60%] transition-opacity duration-300 ease-out ${
              v1Loaded && !isCrossfadingToV2 && !isCrossfadingToStatic
                ? 'opacity-100'
                : 'opacity-0'
            }`}
          />

          {/* Layer C: Video2 (Preloaded Transition Timelapse, crossfade 400ms) */}
          <video
            ref={video2Ref}
            src="/assets/video2.mp4"
            preload="auto"
            muted
            playsInline
            onLoadedData={() => setV2Loaded(true)}
            className={`absolute inset-0 w-full h-full object-cover object-[center_60%] transition-opacity duration-400 ease-out ${
              isCrossfadingToV2 && !isCrossfadingToStatic ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </>
      )}

      {/* Layer D: Static Background Final Frame Overlay (#140a07 / background-akhir.png, crossfade 600ms) */}
      <div
        className={`absolute inset-0 w-full h-full bg-[#140a07] transition-opacity duration-600 ease-out ${
          isCrossfadingToStatic || phase === 'chat' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Layer E: Top scrim (token --scrim-top) agar heading terbaca di atas awan terang */}
      <div
        className={`absolute top-0 left-0 right-0 transition-opacity duration-700 ${
          phase === 'chat' ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ height: 'var(--scrim-top-h)', background: 'var(--scrim-top)' }}
      />

      {/* Layer F: Bottom scrim (token --scrim-bottom) untuk pill, input, dan tagline */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-700 ${
          phase === 'chat' ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ height: 'var(--scrim-bottom-h)', background: 'var(--scrim-bottom)' }}
      />    </div>
  )
}
