// Official SwiftChat brand mark — blue+green squircle with paper-airplane glyph,
// "SwiftChat" wordmark, and "by ConveGenius" subline. Rendered as inline SVG so
// it scales crisply at any size. Pass `size` for the icon height; the wordmark
// scales proportionally.

interface SwiftChatLogoProps {
  size?: number
  showText?: boolean
  vertical?: boolean
}

export default function SwiftChatLogo({ size = 36, showText = true, vertical = false }: SwiftChatLogoProps) {
  const iconW = size
  const iconH = size

  const icon = (
    <svg width={iconW} height={iconH} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <clipPath id="sc-clip"><rect x="0" y="0" width="80" height="80" rx="16" ry="16" /></clipPath>
      </defs>
      <g clipPath="url(#sc-clip)">
        {/* blue + green diagonal split */}
        <rect x="0" y="0" width="80" height="80" fill="#3A66CC" />
        <path d="M0 80 L80 80 L80 0 Z" fill="#26B14C" />
        {/* paper-airplane / swoosh */}
        <path d="M14 36 L66 14 L42 64 L36 44 Z" fill="#FFFFFF" />
        <path d="M14 36 L42 44 L36 44 Z" fill="#E7F5EC" />
        {/* trail dots */}
        <circle cx="26" cy="32" r="1.6" fill="#3A66CC" />
        <circle cx="32" cy="29" r="1.6" fill="#3A66CC" />
        <circle cx="38" cy="26" r="1.6" fill="#3A66CC" />
      </g>
    </svg>
  )

  if (!showText) return icon

  // text scaled to icon size
  const fontMain = Math.round(size * 0.62)
  const fontSub  = Math.max(9, Math.round(size * 0.22))

  if (vertical) {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        {icon}
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: fontMain, lineHeight: 1, letterSpacing: '-0.5px' }}>
          <span style={{ color: '#3A66CC' }}>Swift</span><span style={{ color: '#26B14C' }}>Chat</span>
        </div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: fontSub, color: '#475569', marginTop: 1 }}>
          by <span style={{ color: '#3A66CC', fontWeight: 700 }}>Conve</span><span style={{ color: '#36B5B5', fontWeight: 700 }}>Genius</span>
        </div>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      {icon}
      <div className="flex flex-col leading-tight">
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: fontMain, lineHeight: 1, letterSpacing: '-0.5px' }}>
          <span style={{ color: '#3A66CC' }}>Swift</span><span style={{ color: '#26B14C' }}>Chat</span>
        </div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: fontSub, color: '#475569', marginTop: 2 }}>
          by <span style={{ color: '#3A66CC', fontWeight: 700 }}>Conve</span><span style={{ color: '#36B5B5', fontWeight: 700 }}>Genius</span>
        </div>
      </div>
    </div>
  )
}
