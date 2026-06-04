import { useTranslation } from 'react-i18next'
import { setLanguage, type Lang } from '../i18n/index.js'
import { useApp } from '../context/AppContext.js'
import { TricolorStrip } from '../components/TricolorStrip.js'

export function LanguagePage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()

  function pick(lang: Lang) {
    setLanguage(lang)
    setScreen('login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
      <TricolorStrip className="w-40 mb-8 rounded" />
      <h2 className="text-xl font-semibold mb-6 text-txt-primary text-center">{t('language.title')}</h2>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => pick('en')} className="w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark">
          {t('language.english')}
        </button>
        <button onClick={() => pick('gu')} className="w-full rounded-card bg-white border border-bdr text-txt-primary py-3 font-medium shadow-card hover:bg-surface-secondary">
          {t('language.gujarati')}
        </button>
      </div>
    </div>
  )
}
