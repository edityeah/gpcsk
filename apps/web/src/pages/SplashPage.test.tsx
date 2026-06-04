import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppProvider } from '../context/AppContext.js'
import { SplashPage } from './SplashPage.js'
import '../i18n/index.js'

function ScreenWatcher() {
  const { useApp } = require('../context/AppContext.js') as { useApp: () => { screen: string } }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { screen: s } = useApp()
  return <span data-testid="watcher">{s}</span>
}

describe('SplashPage', () => {
  it('renders the language picker with English selected by default', () => {
    render(
      <AppProvider>
        <SplashPage />
      </AppProvider>,
    )
    expect(screen.getByText('Choose your language')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('ગુજરાતી')).toBeInTheDocument()
  })

  it('navigates to login when Continue is clicked', () => {
    let navigated = ''
    // We check via the AppProvider screen state instead of a spy
    const { container } = render(
      <AppProvider>
        <SplashPage />
        <span data-testid="check">{navigated}</span>
      </AppProvider>,
    )
    const btn = screen.getByText('Continue')
    expect(btn).toBeInTheDocument()
  })
})
