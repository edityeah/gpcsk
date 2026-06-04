// GPCSK Login — 3-slide auto-advancing carousel.
// Mobile: hero on top + rounded bottom-sheet form. Desktop: split (left illustration, right form).
// CTAs: "Login with XGN" + "Continue with Phone Number" + "Demo: pick a role →"

import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.js'
import Logo from '../components/Logo.js'
import SwiftChatLogo from '../components/SwiftChatLogo.js'
import GpcbLogo from '../components/GpcbLogo.js'
import PoweredBy from '../components/PoweredBy.js'
import Mascot from '../components/Mascot.js'

const SLIDES = [
  { id: 0, headline: 'Trusted by',  bold: '50,000+ industrial units monitored across Gujarat', visual: 'students' },
  { id: 1, headline: 'Verified by', bold: 'Air, Water, Hazardous Waste, Noise + 60+ AAQM stations', visual: 'shield' },
  { id: 2, headline: 'Endorsed by', bold: 'GPCB · MoEFCC · CPCB · Swachh Gujarat', visual: 'trophy' },
]

// ── Slide visuals ──
function EllipseLarge({ size = 220 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="110" cy="110" rx="105" ry="105" fill="#386AF6" />
    </svg>
  )
}
function EllipseSmall({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="40" rx="38" ry="38" fill="#5B89FF" />
    </svg>
  )
}
function Shield3D({ width = 150, height = 180 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 150 180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sgpcb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B89FF" />
          <stop offset="100%" stopColor="#2755E3" />
        </linearGradient>
      </defs>
      <path d="M75 4 L138 26 V92 C138 130 113 162 75 176 C37 162 12 130 12 92 V26 L75 4 Z" fill="url(#sgpcb)" stroke="#fff" strokeWidth="2" />
      <path d="M50 90 L68 108 L102 70" stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SlideVisual({ type }: { type: string }) {
  if (type === 'shield') {
    return (
      <div className="relative flex items-center justify-center w-full h-full">
        <div className="absolute" style={{ width: 220, height: 220, opacity: 0.15 }}><EllipseLarge size={220} /></div>
        <div className="absolute" style={{ width: 80, height: 80, bottom: 56, right: 32, opacity: 0.12, transform: 'rotate(-52deg)' }}><EllipseSmall size={80} /></div>
        <div className="relative z-10"><Shield3D width={150} height={180} /></div>
      </div>
    )
  }
  if (type === 'trophy') {
    return (
      <div className="relative flex items-center justify-center w-full h-full">
        <div className="flex flex-col items-center">
          <div className="text-[110px] leading-none select-none">🏆</div>
          <div className="mt-2 flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-card">
            <span className="text-[14px]">🌿</span>
            <span className="text-[11px] font-bold text-txt-secondary">Swachh Gujarat</span>
          </div>
        </div>
        <div className="absolute top-8 left-8 w-6 h-6 border-2 border-primary-light rounded-full opacity-40" />
        <div className="absolute bottom-16 right-6 w-4 h-4 border-2 border-primary-light rotate-45 opacity-40" />
        <div className="absolute top-14 right-4 w-5 h-5 rounded-full border-[1.5px] border-txt-tertiary opacity-30" />
      </div>
    )
  }
  // students — retargeted to industrial/pollution workers
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <div className="absolute" style={{ width: 220, height: 220, opacity: 0.12 }}><EllipseLarge size={220} /></div>
      <div className="relative z-10 flex gap-4 items-end">
        <div className="flex flex-col items-center">
          <div className="w-16 h-20 bg-[#FFC107] rounded-t-full rounded-b-lg shadow-card flex items-end justify-center pb-1">
            <span className="text-[30px]">🏭</span>
          </div>
          <div className="w-14 h-5 bg-[#FF9800] rounded-sm mt-0.5" />
        </div>
        <div className="flex flex-col items-center mb-2">
          <div className="w-14 h-16 bg-[#1565C0] rounded-t-full rounded-b-lg shadow-card flex items-end justify-center pb-1">
            <span className="text-[26px]">👷</span>
          </div>
          <div className="w-12 h-4 bg-[#1976D2] rounded-sm mt-0.5" />
        </div>
        <div className="flex flex-col items-center">
          <div className="w-14 h-18 bg-[#43A047] rounded-t-full rounded-b-lg shadow-card flex items-end justify-center pb-1">
            <span className="text-[26px]">🌱</span>
          </div>
          <div className="w-12 h-4 bg-[#2E7D32] rounded-sm mt-0.5" />
        </div>
      </div>
    </div>
  )
}

function MobileHero({ slide, total }: { slide: typeof SLIDES[0]; total: number }) {
  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: '#F4F6FA' }}>
      <div className="absolute top-10 right-5 text-right z-10 pointer-events-none" style={{ maxWidth: 180 }}>
        <p className="text-[13px] font-medium text-txt-secondary leading-snug">{slide.headline}</p>
        <p className="text-[14px] font-bold text-txt-secondary leading-snug mt-0.5">{slide.bold}</p>
      </div>
      <SlideVisual type={slide.visual} />
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 items-center">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="transition-all duration-300"
            style={{ width: i === slide.id ? 20 : 8, height: 8, borderRadius: 4, background: i === slide.id ? '#386AF6' : '#C5CBDC' }} />
        ))}
      </div>
    </div>
  )
}

function DesktopPanel({ slide, total }: { slide: typeof SLIDES[0]; total: number }) {
  return (
    <div className="hidden md:flex flex-col h-full overflow-hidden relative" style={{ background: '#F4F6FA', flex: '1 1 0' }}>
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(56,106,246,0.10) 0%, rgba(56,106,246,0) 70%)', transform: 'translate(-30%, -20%)' }} />
      <div className="absolute bottom-0 right-0 w-[460px] h-[460px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(38,177,76,0.10) 0%, rgba(38,177,76,0) 70%)', transform: 'translate(20%, 25%)' }} />
      <div className="absolute top-1/3 right-10 w-3 h-3 rounded-full bg-primary opacity-30" />
      <div className="absolute bottom-1/4 left-12 w-5 h-5 rounded-pill rotate-45 bg-[#26B14C] opacity-20" />

      {/* Header logos */}
      <div className="p-8 flex items-center justify-between gap-4 relative z-10">
        <SwiftChatLogo size={36} />
        <GpcbLogo size={30} showText={false} />
      </div>

      {/* Illustration */}
      <div className="flex-1 flex items-center justify-center px-10 z-10 overflow-hidden">
        <div className="w-[min(320px,60%)] aspect-square relative">
          <SlideVisual type={slide.visual} />
        </div>
      </div>

      {/* Caption + dots */}
      <div className="px-10 z-10 text-center">
        <p className="text-[13px] font-semibold text-txt-secondary uppercase tracking-wider">{slide.headline}</p>
        <p className="text-[18px] font-bold text-txt-primary mt-1.5 leading-snug max-w-[440px] mx-auto">{slide.bold}</p>
        <div className="flex gap-2 mt-4 justify-center">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="transition-all duration-300 rounded-full"
              style={{ width: i === slide.id ? 24 : 8, height: 8, background: i === slide.id ? '#386AF6' : '#C5CBDC' }} />
          ))}
        </div>
      </div>

      {/* Mascot — anchored at the bottom */}
      <div className="flex justify-center pb-2 pt-4 z-10 relative">
        <Mascot size={220} />
      </div>
    </div>
  )
}

function LoginPanel({ navigate }: { navigate: (s: 'xgn_redirect' | 'phone_entry' | 'demo_role_picker') => void }) {
  const Buttons = () => (
    <>
      <button onClick={() => navigate('xgn_redirect')}
        className="w-full bg-primary text-white font-bold text-[15px] py-3.5 rounded-pill shadow-modal active:opacity-80 transition-opacity"
        style={{ fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.2px' }}>
        Login with XGN
      </button>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-bdr" />
        <span className="text-[11px] font-semibold text-txt-tertiary">or</span>
        <div className="flex-1 h-px bg-bdr" />
      </div>
      <button onClick={() => navigate('phone_entry')}
        className="w-full border-[1.5px] border-primary text-primary font-semibold text-[14px] h-12 rounded-pill bg-white active:bg-primary-light transition-colors">
        Continue with Phone Number
      </button>
      <button onClick={() => navigate('demo_role_picker')}
        className="w-full text-primary font-semibold text-[13px] py-2 hover:underline">
        Demo: pick a role →
      </button>
    </>
  )

  return (
    <div className="flex flex-col bg-white" style={{ flexShrink: 0 }}>
      {/* Desktop */}
      <div className="hidden md:flex flex-col px-10 pt-10 pb-6 gap-4">
        <div className="mb-4">
          <p className="text-[16px] text-txt-secondary" style={{ fontFamily: 'Montserrat, sans-serif' }}>Namaste! Welcome to</p>
          <h1 className="text-[34px] font-bold text-txt-primary leading-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Gujarat Pollution Control
          </h1>
          <h1 className="text-[34px] font-bold text-txt-primary leading-tight -mt-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Samiksha Kendra
          </h1>
        </div>
        <Buttons />
        <p className="text-center text-[11px] text-txt-tertiary mt-3 leading-relaxed">
          By continuing, I agree to GPCSK&apos;s{' '}
          <span className="text-primary cursor-pointer">Terms of Service</span> and{' '}
          <span className="text-primary cursor-pointer">DPDP-A Policy</span>
        </p>
        <div className="mt-6 pt-4 border-t border-bdr-light flex items-center justify-center">
          <PoweredBy size={20} />
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col rounded-t-3xl gap-4" style={{ padding: '28px 16px 24px', boxShadow: '0 -4px 24px rgba(56,106,246,0.10)' }}>
        <Buttons />
        <div className="text-center text-[10px] text-txt-secondary">
          By continuing, I agree to GPCSK&apos;s{' '}
          <span className="text-primary cursor-pointer">Terms</span> and{' '}
          <span className="text-primary cursor-pointer">DPDP-A Policy</span>
        </div>
        <div className="pt-2 flex items-center justify-center">
          <PoweredBy size={18} />
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { navigate } = useApp()
  const [slideIdx, setSlideIdx] = useState(0)

  const advance = useCallback(() => setSlideIdx(i => (i + 1) % SLIDES.length), [])
  useEffect(() => { const t = setInterval(advance, 3500); return () => clearInterval(t) }, [advance])

  const slide = SLIDES[slideIdx] ?? SLIDES[0]!

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <DesktopPanel slide={slide} total={SLIDES.length} />
      <div className="md:hidden flex-1 flex flex-col overflow-hidden min-h-screen">
        <MobileHero slide={slide} total={SLIDES.length} />
        <LoginPanel navigate={navigate} />
      </div>
      <div className="hidden md:flex flex-col justify-center flex-shrink-0"
        style={{ width: 'clamp(340px, 38%, 460px)', background: '#fff', borderLeft: '1px solid #E8EDF5' }}>
        <LoginPanel navigate={navigate} />
      </div>
    </div>
  )
}
