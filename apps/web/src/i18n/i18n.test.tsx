import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import i18n, { setLanguage } from './index.js'

function Probe() {
  const { t } = useTranslation()
  return <span>{t('appName')}</span>
}

describe('i18n', () => {
  beforeEach(() => setLanguage('en'))

  it('renders English by default', () => {
    render(<Probe />)
    expect(screen.getByText('Gujarat Pollution Control Samiksha Kendra')).toBeInTheDocument()
  })

  it('switches to Gujarati on setLanguage("gu")', async () => {
    setLanguage('gu')
    await i18n.changeLanguage('gu')
    render(<Probe />)
    expect(screen.getByText('ગુજરાત પ્રદૂષણ નિયંત્રણ સમીક્ષા કેન્દ્ર')).toBeInTheDocument()
  })
})
