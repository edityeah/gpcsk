import { useApp } from '../context/AppContext.js'

export default function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  const kind = toast.kind ?? 'info'
  const styles: Record<string, string> = {
    info:    'bg-slate-900 text-white',
    success: 'bg-ok text-white',
    warn:    'bg-warn text-white',
    danger:  'bg-danger text-white',
  }
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in">
      <div className={`px-4 py-2 rounded-pill shadow-modal text-sm ${styles[kind] ?? styles.info}`}>{toast.text}</div>
    </div>
  )
}
