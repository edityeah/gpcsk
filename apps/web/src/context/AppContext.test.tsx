import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AppProvider, useApp } from './AppContext.js'

function Probe() {
  const { screen: s, navigate, goBack } = useApp()
  return (
    <div>
      <span data-testid="screen">{s}</span>
      <button onClick={() => navigate('login')}>go-login</button>
      <button onClick={() => navigate('phone_entry')}>go-phone</button>
      <button onClick={goBack}>go-back</button>
    </div>
  )
}

describe('AppContext', () => {
  it('defaults to splash', () => {
    render(<AppProvider><Probe /></AppProvider>)
    expect(screen.getByTestId('screen')).toHaveTextContent('splash')
  })

  it('navigates screens via navigate()', () => {
    render(<AppProvider><Probe /></AppProvider>)
    act(() => screen.getByText('go-login').click())
    expect(screen.getByTestId('screen')).toHaveTextContent('login')
  })

  it('goBack() pops the history stack', () => {
    render(<AppProvider><Probe /></AppProvider>)
    act(() => screen.getByText('go-login').click())
    act(() => screen.getByText('go-phone').click())
    expect(screen.getByTestId('screen')).toHaveTextContent('phone_entry')
    act(() => screen.getByText('go-back').click())
    expect(screen.getByTestId('screen')).toHaveTextContent('login')
  })
})
