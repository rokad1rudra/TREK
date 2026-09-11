import React from 'react'

export interface RoutePathDrawProps {
  startLabel?: string
  endLabel?: string
  width?: number | string
  height?: number | string
  durationSec?: number
  className?: string
}

/**
 * RoutePathDraw
 * Animated SVG Route Panel matching exact specs:
 * - Electric Blue -> Purple shimmering gradient path
 * - Glowing Comet Head (amber halo + white core) traveling start -> end
 * - Sequential sparkle particles along trail
 * - Glassmorphic pins (translucent green halo start, translucent red halo end)
 * - Floating dark glassmorphic panel container with subtle shadow & inner highlight
 */
export const RoutePathDraw: React.FC<RoutePathDrawProps> = ({
  startLabel = 'Surat',
  endLabel = 'Manali',
  width = '100%',
  height = 220,
  durationSec = 4.0,
  className = '',
}) => {
  const uid = React.useId()
  // Smooth double-curve matching screenshot (Start left-middle -> crest up -> dip down -> End right-middle)
  const pathD = 'M 45 120 C 130 20, 250 200, 355 85'

  return (
    <div
      className={`relative flex flex-col items-center justify-between rounded-[24px] p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f1422] to-[#0a0d16] border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden ${className}`}
      style={{ width, minHeight: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* Background Subtle Ambient Glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* SVG Canvas */}
      <svg
        viewBox="0 0 400 180"
        className="w-full h-full max-w-xl overflow-visible drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Shimmer Blue -> Purple Gradient */}
          <linearGradient id={`${uid}-line-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>

          {/* Path Glow Filter */}
          <filter id={`${uid}-line-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Yellow Comet Glow Filter */}
          <filter id={`${uid}-comet-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Amber/Gold Radial Halo for Comet Head */}
          <radialGradient id={`${uid}-comet-halo`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
            <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
          </radialGradient>

          {/* Start Green Glassmorphic Pin Radial Glow */}
          <radialGradient id={`${uid}-start-halo`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </radialGradient>

          {/* End Red Glassmorphic Pin Radial Glow */}
          <radialGradient id={`${uid}-end-halo`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Master Curved Path Reference */}
        <path id={uid} d={pathD} fill="none" />

        {/* Base Glowing Guide Path */}
        <path
          d={pathD}
          stroke="rgba(56, 189, 248, 0.25)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Animated Shimmering Path (Blue -> Purple Gradient) */}
        <path
          d={pathD}
          stroke={`url(#${uid}-line-grad)`}
          strokeWidth="3"
          strokeLinecap="round"
          filter={`url(#${uid}-line-glow)`}
          style={{
            strokeDasharray: '1000',
            strokeDashoffset: '1000',
            animation: `shimmerDraw ${durationSec}s ease-in-out infinite`,
          }}
        />

        {/* Sparkle Particles along path trail */}
        <g opacity="0.85">
          <circle cx="105" cy="58" r="2.5" fill="#ffffff" className="animate-ping" style={{ animationDuration: '2.2s' }} />
          <circle cx="105" cy="58" r="1.8" fill="#e0f2fe" />

          <circle cx="252" cy="155" r="2.5" fill="#ffffff" className="animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.4s' }} />
          <circle cx="252" cy="155" r="1.8" fill="#e0f2fe" />

          <circle cx="320" cy="120" r="2.2" fill="#ffffff" className="animate-ping" style={{ animationDuration: '2.6s', animationDelay: '0.8s' }} />
          <circle cx="320" cy="120" r="1.5" fill="#fef08a" />
        </g>

        {/* Glassmorphic Start Pin (Green Translucent Halo + Solid Core) */}
        <g transform="translate(45, 120)">
          <circle r="18" fill={`url(#${uid}-start-halo)`} className="animate-pulse" />
          <circle r="9" fill="#10b981" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="2" />
          <circle r="4" fill="#ffffff" />
        </g>

        {/* Glassmorphic End Pin (Red Translucent Halo + Solid Core) */}
        <g transform="translate(355, 85)">
          <circle r="18" fill={`url(#${uid}-end-halo)`} className="animate-pulse" />
          <circle r="9" fill="#ef4444" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="2" />
          <circle r="4" fill="#ffffff" />
        </g>

        {/* Glowing Yellow Comet Head Dot (Amber Halo + Bright White Core) Traveling Start -> End */}
        <g filter={`url(#${uid}-comet-glow)`}>
          {/* Outer Soft Amber Halo */}
          <circle r="16" fill={`url(#${uid}-comet-halo)`} />
          {/* Inner Golden Aura */}
          <circle r="8" fill="#fbbf24" opacity="0.9" />
          {/* Bright White Core */}
          <circle r="4.5" fill="#ffffff" />

          {/* Smooth Traveling Motion Along Path */}
          <animateMotion
            path={pathD}
            dur={`${durationSec}s`}
            repeatCount="indefinite"
            rotate="auto"
            calcMode="spline"
            keySplines="0.4 0 0.2 1"
          />
        </g>
      </svg>

      {/* Footer Start & Destination Badges */}
      <div className="w-full max-w-xl flex items-center justify-between px-2 pt-1 text-xs font-semibold tracking-wide text-slate-200">
        <div className="flex items-center space-x-2 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1.5 rounded-full text-emerald-400 shadow-md backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>🟢 {startLabel}</span>
        </div>

        <div className="flex items-center space-x-1.5 text-amber-300 font-mono text-[11px] bg-slate-900/60 border border-amber-500/20 px-3 py-1 rounded-full shadow-inner">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>Live Highway Route</span>
        </div>

        <div className="flex items-center space-x-2 bg-red-950/70 border border-red-500/30 px-3 py-1.5 rounded-full text-red-400 shadow-md backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
          <span>📍 {endLabel}</span>
        </div>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmerDraw {
          0% {
            stroke-dashoffset: 1000;
            opacity: 0.3;
          }
          50% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          85% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -1000;
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  )
}

export default RoutePathDraw
