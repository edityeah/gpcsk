// "An initiative of GPCB + SwiftChat by ConveGenius" badge.
// Used in auth screens and headers.
import SwiftChatLogo from './SwiftChatLogo.js'
import GpcbLogo from './GpcbLogo.js'

interface PoweredByProps {
  size?: number
  className?: string
  layout?: 'row' | 'stack'
}

export default function PoweredBy({ size = 22, className = '', layout = 'row' }: PoweredByProps) {
  if (layout === 'stack') {
    return (
      <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
        <div className="text-[10px] uppercase tracking-wider text-txt-tertiary font-semibold">An initiative of</div>
        <div className="flex items-center gap-4">
          <GpcbLogo size={size + 6} />
          <div className="w-px h-7 bg-bdr" />
          <SwiftChatLogo size={size + 4} />
        </div>
      </div>
    )
  }
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <GpcbLogo size={size + 4} />
      <div className="w-px h-6 bg-bdr" />
      <SwiftChatLogo size={size} />
    </div>
  )
}
