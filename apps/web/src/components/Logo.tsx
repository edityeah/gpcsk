// GPCSK logo — chat-bubble squircle SVG. Rebrand of KSK Logo.
// Renders inline SVG so it scales crisply at any size.

interface LogoProps {
  size?: number
  showText?: boolean
  textColor?: string
}

export default function Logo({ size = 64, showText = false, textColor = '#1A1F36' }: LogoProps) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="gpcskgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#5B89FF" />
            <stop offset="100%" stopColor="#2755E3" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#gpcskgrad)" />
        {/* chat bubble + spark */}
        <path d="M16 22a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H30l-7 6v-6h-1a6 6 0 0 1-6-6V22z" fill="#FFFFFF" opacity="0.95"/>
        <circle cx="26" cy="29" r="2" fill="#386AF6" />
        <circle cx="32" cy="29" r="2" fill="#386AF6" />
        <circle cx="38" cy="29" r="2" fill="#386AF6" />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-[15px]" style={{ color: textColor, fontFamily: 'Montserrat, sans-serif' }}>GPCSK</span>
          <span className="text-[10px] font-medium mt-0.5" style={{ color: '#7383A5' }}>Samiksha Kendra</span>
        </div>
      )}
    </div>
  )
}
