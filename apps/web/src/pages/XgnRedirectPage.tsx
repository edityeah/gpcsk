import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext.js'

const DEMO_XGN_IDS = [
  { id: 'XGN-CO-001',  label: 'Consent Officer' },
  { id: 'XGN-MO-001',  label: 'Monitoring Officer' },
  { id: 'XGN-IEO-001', label: 'Inspection & Enforcement Officer' },
  { id: 'XGN-CMP-001', label: 'Complaints Officer' },
  { id: 'XGN-SR-001',  label: 'Senior Reviewer' },
] as const

export function XgnRedirectPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const [chosen, setChosen] = useState<string>('XGN-SR-001')
  const [auto, setAuto] = useState(false)

  useEffect(() => {
    if (!auto) return
    const id = setTimeout(() => {
      sessionStorage.setItem('gpcsk:pending-xgn', chosen)
      setScreen('xgn_verifying')
    }, 1200)
    return () => clearTimeout(id)
  }, [auto, chosen, setScreen])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
      <h2 className="text-xl font-semibold mb-2 text-txt-primary">{t('xgn.redirecting')}</h2>
      <p className="text-txt-secondary text-sm mb-6">{t('xgn.selectId')}</p>
      <div className="w-full max-w-sm flex flex-col gap-2">
        {DEMO_XGN_IDS.map(({ id, label }) => (
          <label key={id} className={`flex items-center gap-3 border rounded-card px-4 py-3 cursor-pointer ${chosen === id ? 'border-primary bg-primary-light' : 'border-bdr bg-white'}`}>
            <input type="radio" checked={chosen === id} onChange={() => setChosen(id)} />
            <div>
              <div className="font-mono text-sm text-txt-primary">{id}</div>
              <div className="text-xs text-txt-secondary">{label}</div>
            </div>
          </label>
        ))}
        <button onClick={() => setAuto(true)} className="mt-3 w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark">
          {t('xgn.continue')}
        </button>
      </div>
    </div>
  )
}
