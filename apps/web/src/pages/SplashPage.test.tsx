import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AppProvider, useApp } from '../context/AppContext.js'
import { SplashPage } from './SplashPage.js'
import '../i18n/index.js'

function ScreenWatcher() {
  const { screen: s } = useApp()
  return <span data-testid="watcher">{s}</span>
}

describe('SplashPage', () => {
  it('renders the app name and transitions to language after 1.5s', () => {
    vi.useFakeTimers()
    render(
      <AppProvider>
        <SplashPage />
        <ScreenWatcher />
      </AppProvider>,
    )
    expect(screen.getByText('Gujarat Pollution Control Samiksha Kendra')).toBeInTheDocument()
    expect(screen.getByTestId('watcher')).toHaveTextContent('splash')
    act(() => { vi.advanceTimersByTime(1600) })
    expect(screen.getByTestId('watcher')).toHaveTextContent('language')
    vi.useRealTimers()
  })
})
