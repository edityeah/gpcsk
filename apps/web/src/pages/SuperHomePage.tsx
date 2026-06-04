import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.js'
import { TopBar } from '../components/shell/TopBar.js'
import { Sidebar } from '../components/shell/Sidebar.js'
import { AskAiPanel } from '../components/shell/AskAiPanel.js'
import { CanvasPanel } from '../components/shell/CanvasPanel.js'

export function SuperHomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <TopBar />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            <div className="px-6 pt-6">
              <h1 className="text-2xl font-semibold text-txt-primary">
                {t('home.greeting', { name: user?.name ?? '' })}
              </h1>
            </div>
            <AskAiPanel />
          </div>
          <CanvasPanel />
        </main>
      </div>
    </div>
  )
}
