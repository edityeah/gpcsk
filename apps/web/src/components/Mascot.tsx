// SwiftChat mascot — two stylised chicks with phones.
//
// Prefers the official GIF if it exists at /swiftchat-mascot.gif (drop the
// file into web/public/), and falls back to an inline SVG approximation.

import { useState } from 'react'

interface MascotProps {
  size?: number
  className?: string
}

export default function Mascot({ size = 220, className = '' }: MascotProps) {
  const [imgFailed, setImgFailed] = useState(false)
  if (imgFailed) return <MascotSvg size={size} className={className} />
  return (
    <img
      src="/swiftchat-mascot.gif"
      alt="SwiftChat mascot"
      width={size}
      height={size}
      onError={() => setImgFailed(true)}
      className={`select-none pointer-events-none ${className}`}
      style={{ objectFit: 'contain' }}
    />
  )
}

// Inline SVG fallback — two birds, white body with green outline, holding
// blue smartphones in selfie pose. One bird wears round glasses.
function MascotSvg({ size = 220, className = '' }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="bg-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#F4F6FA" />
          <stop offset="100%" stopColor="#E9F0F9" />
        </linearGradient>
      </defs>

      {/* soft ground */}
      <ellipse cx="160" cy="200" rx="120" ry="10" fill="#E9F0F9" />

      {/* LEFT BIRD */}
      <g transform="translate(20, 30)">
        {/* tail */}
        <path d="M0 90 Q-10 80 0 70 L40 90 Z" fill="#fff" stroke="#26B14C" strokeWidth="2.5" strokeLinejoin="round" />
        {/* body */}
        <path d="M30 60 Q30 30 70 30 Q120 30 120 80 Q120 130 70 130 Q30 130 30 95 Z"
          fill="#fff" stroke="#26B14C" strokeWidth="3" />
        {/* belly highlight */}
        <path d="M55 95 Q55 75 80 75 Q105 75 105 95 Q105 120 80 120 Q55 120 55 95 Z" fill="#E7F5EC" opacity="0.7" />
        {/* head tufts */}
        <path d="M65 30 q-3 -10 0 -16 q4 6 6 10 z" fill="#26B14C" />
        <path d="M75 28 q-2 -12 2 -18 q4 8 4 14 z" fill="#26B14C" />
        <path d="M85 30 q3 -10 0 -16 q-4 6 -6 10 z" fill="#26B14C" />
        {/* eye */}
        <circle cx="78" cy="48" r="4" fill="#1F2937" />
        <circle cx="79" cy="47" r="1.2" fill="#fff" />
        {/* beak */}
        <path d="M50 56 L62 58 L52 64 Z" fill="#26B14C" />
        {/* wing */}
        <path d="M70 85 Q90 85 105 110 Q90 115 75 108 Z" fill="#fff" stroke="#26B14C" strokeWidth="2.5" />
        {/* arm holding phone */}
        <path d="M105 80 L130 75" stroke="#26B14C" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* phone */}
        <g transform="translate(125 30) rotate(15)">
          <rect x="0" y="0" width="30" height="50" rx="5" fill="#3A66CC" />
          <rect x="2" y="3" width="26" height="44" rx="3" fill="#E9F0F9" />
          <circle cx="15" cy="7" r="1.6" fill="#3A66CC" />
        </g>
        {/* legs */}
        <line x1="65" y1="130" x2="60" y2="148" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="85" y1="130" x2="90" y2="148" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        {/* feet */}
        <path d="M55 150 L60 148 L65 150" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M85 150 L90 148 L95 150" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      {/* RIGHT BIRD (with glasses) */}
      <g transform="translate(180, 30)">
        {/* tail */}
        <path d="M120 90 Q130 80 120 70 L80 90 Z" fill="#fff" stroke="#26B14C" strokeWidth="2.5" strokeLinejoin="round" />
        {/* body */}
        <path d="M30 60 Q30 30 70 30 Q120 30 120 80 Q120 130 70 130 Q30 130 30 95 Z"
          fill="#fff" stroke="#26B14C" strokeWidth="3" />
        <path d="M55 95 Q55 75 80 75 Q105 75 105 95 Q105 120 80 120 Q55 120 55 95 Z" fill="#E7F5EC" opacity="0.7" />
        {/* head tufts */}
        <path d="M65 30 q-3 -10 0 -16 q4 6 6 10 z" fill="#26B14C" />
        <path d="M75 28 q-2 -12 2 -18 q4 8 4 14 z" fill="#26B14C" />
        <path d="M85 30 q3 -10 0 -16 q-4 6 -6 10 z" fill="#26B14C" />
        {/* glasses */}
        <circle cx="72" cy="48" r="7" fill="none" stroke="#1F2937" strokeWidth="2" />
        <circle cx="88" cy="48" r="7" fill="none" stroke="#1F2937" strokeWidth="2" />
        <line x1="79" y1="48" x2="81" y2="48" stroke="#1F2937" strokeWidth="2" />
        <circle cx="72" cy="48" r="2" fill="#1F2937" />
        <circle cx="88" cy="48" r="2" fill="#1F2937" />
        {/* beak */}
        <path d="M48 58 L60 60 L50 65 Z" fill="#26B14C" />
        {/* wing */}
        <path d="M70 85 Q90 85 105 110 Q90 115 75 108 Z" fill="#fff" stroke="#26B14C" strokeWidth="2.5" />
        {/* arm holding phone — raised */}
        <path d="M40 65 Q25 50 30 35" stroke="#26B14C" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* phone — tilted up */}
        <g transform="translate(10 10) rotate(-20)">
          <rect x="0" y="0" width="30" height="50" rx="5" fill="#3A66CC" />
          <rect x="2" y="3" width="26" height="44" rx="3" fill="#E9F0F9" />
          <circle cx="15" cy="7" r="1.6" fill="#3A66CC" />
        </g>
        {/* legs */}
        <line x1="65" y1="130" x2="60" y2="148" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="85" y1="130" x2="90" y2="148" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M55 150 L60 148 L65 150" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M85 150 L90 148 L95 150" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
