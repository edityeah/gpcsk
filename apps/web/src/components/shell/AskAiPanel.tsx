import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'

export function AskAiPanel() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col items-stretch p-6">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-end">
        <div className="text-txt-secondary text-sm mb-3">{t('home.askAi')}</div>
        <div className="flex items-center gap-2 rounded-card border border-bdr bg-white shadow-card px-3 py-2">
          <input
            placeholder={t('home.placeholder')}
            className="flex-1 bg-transparent focus:outline-none text-txt-primary"
          />
          <button className="p-2 rounded-card bg-primary text-white hover:bg-primary-dark" title="Send">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
