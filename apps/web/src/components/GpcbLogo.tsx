// GPCB brand mark — leaf/water motif in GPCB blue (#1F66B4) and green (#43A047).
// "GPCB" wordmark + "Gujarat Pollution Control Board" subline.
// Same props as SwiftChatLogo: size, showText, vertical.

interface GpcbLogoProps {
  size?: number
  showText?: boolean
  vertical?: boolean
}

export default function GpcbLogo({ size = 36, showText = true, vertical = false }: GpcbLogoProps) {
  const iconW = size
  const iconH = size

  const icon = (
    <svg width={iconW} height={iconH} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <clipPath id="gpcb-clip"><rect x="0" y="0" width="80" height="80" rx="16" ry="16" /></clipPath>
      </defs>
      <g clipPath="url(#gpcb-clip)">
        <rect x="0" y="0" width="80" height="80" fill="#1F66B4" />
        {/* water wave background */}
        <path d="M0 55 Q20 45 40 55 Q60 65 80 55 L80 80 L0 80 Z" fill="#1558A0" opacity="0.6" />
        {/* leaf motif */}
        <path d="M40 10 C 20 20, 15 45, 40 60 C 65 45, 60 20, 40 10 Z" fill="#43A047" opacity="0.9" />
        <path d="M40 10 C 40 30, 38 48, 40 60" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.7" />
        {/* air/water droplet */}
        <path d="M40 22 C 36 30, 32 36, 40 44 C 48 36, 44 30, 40 22 Z" fill="#FFFFFF" opacity="0.85" />
      </g>
    </svg>
  )

  if (!showText) return icon

  const fontMain = Math.round(size * 0.62)
  const fontSub  = Math.max(8, Math.round(size * 0.19))

  if (vertical) {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        {icon}
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: fontMain, lineHeight: 1, letterSpacing: '-0.5px', color: '#1F66B4' }}>
          GPCB
        </div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: fontSub, color: '#475569', marginTop: 1, textAlign: 'center' }}>
          Gujarat Pollution Control Board
        </div>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      {icon}
      <div className="flex flex-col leading-tight">
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: fontMain, lineHeight: 1, letterSpacing: '-0.5px', color: '#1F66B4' }}>
          GPCB
        </div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: fontSub, color: '#475569', marginTop: 2 }}>
          Gujarat Pollution Control Board
        </div>
      </div>
    </div>
  )
}
