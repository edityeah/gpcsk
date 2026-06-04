import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext.js'
import { TricolorStrip } from '../components/TricolorStrip.js'

export function SplashPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()

  useEffect(() => {
    const id = setTimeout(() => setScreen('language'), 1500)
    return () => clearTimeout(id)
  }, [setScreen])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page text-txt-primary">
      <TricolorStrip className="w-48 mb-8 rounded" />
      <h1 className="text-2xl md:text-3xl font-semibold text-center px-6">{t('appName')}</h1>
      <p className="text-txt-secondary mt-3 text-center px-6">{t('splash.tagline')}</p>
    </div>
  )
}
