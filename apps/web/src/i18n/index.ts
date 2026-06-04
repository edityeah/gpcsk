import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import gu from './locales/gu.json'
import hi from './locales/hi.json'

const KEY = 'gpcsk:lang'

export type Lang = 'en' | 'gu' | 'hi'

const stored = (typeof window !== 'undefined' && (localStorage.getItem(KEY) as Lang | null)) || null

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    gu: { translation: gu },
    hi: { translation: hi },
  },
  lng: stored ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: Lang) {
  i18n.changeLanguage(lang)
  if (typeof window !== 'undefined') localStorage.setItem(KEY, lang)
}

export default i18n
