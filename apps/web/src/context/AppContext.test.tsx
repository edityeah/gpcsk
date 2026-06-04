import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AppProvider, useApp } from './AppContext.js'

function Probe() {
  const { screen: s, setScreen } = useApp()
  return (
    <div>
      <span data-testid="screen">{s}</span>
      <button onClick={() => setScreen('login')}>go</button>
    </div>
  )
}

describe('AppContext', () => {
  it('defaults to splash', () => {
    render(<AppProvider><Probe /></AppProvider>)
    expect(screen.getByTestId('screen')).toHaveTextContent('splash')
  })

  it('transitions screens via setScreen', () => {
    render(<AppProvider><Probe /></AppProvider>)
    act(() => screen.getByText('go').click())
    expect(screen.getByTestId('screen')).toHaveTextContent('login')
  })
})
