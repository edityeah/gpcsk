// GPCSK Splash — combined splash + language picker.
// Three languages: English, Gujarati, Hindi.
// Mascot at top, language grid in middle, Continue + PoweredBy at bottom.

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApp, type Lang } from '../context/AppContext.js'
import PoweredBy from '../components/PoweredBy.js'
import Mascot from '../components/Mascot.js'

const LANGS: { code: Lang; native: string; english: string }[] = [
  { code: 'en', native: 'English',   english: 'English'   },
  { code: 'gu', native: 'ગુજરાતી',   english: 'Gujarati'  },
  { code: 'hi', native: 'हिन्दी',     english: 'Hindi'     },
]

export function SplashPage() {
  const { navigate, lang, setLang } = useApp()
  const { i18n } = useTranslation()
  const [selected, setSelected] = useState<Lang>(lang ?? 'en')

  const handleContinue = () => {
    setLang(selected)
    void i18n.changeLanguage(selected)
    navigate('login')
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="w-full max-w-[480px] mx-auto h-full flex flex-col justify-evenly px-5 py-4">

        {/* Mascot + heading */}
        <div className="flex flex-col items-center text-center flex-shrink-0">
          <Mascot size={260} />
          <h1 className="text-[24px] font-bold text-txt-primary leading-tight -mt-3">Choose your language</h1>
          <p className="text-[13px] text-txt-secondary mt-1">You can change this anytime from the Settings.</p>
        </div>

        {/* Language grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[400px] mx-auto flex-shrink-0">
          {LANGS.map(l => {
            const active = selected === l.code
            return (
              <button
                key={l.code}
                onClick={() => setSelected(l.code)}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 py-3 px-2 transition-all active:scale-[0.97] ${
                  active ? 'bg-ok-light border-ok' : 'bg-white border-bdr hover:border-primary'
                }`}
              >
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-ok flex items-center justify-center">
                    <Check size={10} color="#fff" strokeWidth={3} />
                  </span>
                )}
                <span className={`text-[16px] font-bold leading-tight ${active ? 'text-ok' : 'text-txt-primary'}`} style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                  {l.native}
                </span>
                {l.code !== 'en' && (
                  <span className="text-[10px] text-txt-tertiary leading-tight mt-0.5">{l.english}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Continue + logos */}
        <div className="w-full max-w-[400px] mx-auto flex flex-col items-center gap-3 flex-shrink-0">
          <button
            onClick={handleContinue}
            className="w-full bg-primary text-white font-bold text-[16px] py-3.5 rounded-pill shadow-modal active:opacity-80 transition-opacity">
            Continue
          </button>
          <PoweredBy size={28} />
        </div>
      </div>
    </div>
  )
}
