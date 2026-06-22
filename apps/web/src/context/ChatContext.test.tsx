import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ChatProvider, useChat } from './ChatContext.js'
import { AuthProvider } from './AuthContext.js'
import { AppProvider } from './AppContext.js'

// Minimal wrapper that provides all required contexts
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthProvider>
        <ChatProvider>{children}</ChatProvider>
      </AuthProvider>
    </AppProvider>
  )
}

// Probe component that exercises the canvas stack API
function CanvasProbe() {
  const { canvasState, canvasStack, openCanvas, backCanvas, closeCanvas } = useChat()
  return (
    <div>
      <span data-testid="module">{canvasState.module ?? 'none'}</span>
      <span data-testid="stack-len">{canvasStack.length}</span>
      <button onClick={() => openCanvas('OPEN_PROGRAMS')}>open-programs</button>
      <button onClick={() => openCanvas('OPEN_OCEMS_LIVE_GRID')}>open-ocems</button>
      <button onClick={backCanvas}>back</button>
      <button onClick={closeCanvas}>close</button>
    </div>
  )
}

describe('ChatContext canvas stack', () => {
  it('canvasState.module is null initially', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    expect(screen.getByTestId('module')).toHaveTextContent('none')
    expect(screen.getByTestId('stack-len')).toHaveTextContent('0')
  })

  it('openCanvas() pushes onto the stack', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    act(() => screen.getByText('open-programs').click())
    expect(screen.getByTestId('module')).toHaveTextContent('OPEN_PROGRAMS')
    expect(screen.getByTestId('stack-len')).toHaveTextContent('1')
  })

  it('openCanvas() twice pushes two entries', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    act(() => screen.getByText('open-programs').click())
    act(() => screen.getByText('open-ocems').click())
    expect(screen.getByTestId('module')).toHaveTextContent('OPEN_OCEMS_LIVE_GRID')
    expect(screen.getByTestId('stack-len')).toHaveTextContent('2')
  })

  it('backCanvas() pops to the previous canvas', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    act(() => screen.getByText('open-programs').click())
    act(() => screen.getByText('open-ocems').click())
    act(() => screen.getByText('back').click())
    expect(screen.getByTestId('module')).toHaveTextContent('OPEN_PROGRAMS')
    expect(screen.getByTestId('stack-len')).toHaveTextContent('1')
  })

  it('backCanvas() with stack length 1 empties the stack (returns to home)', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    act(() => screen.getByText('open-programs').click())
    act(() => screen.getByText('back').click())
    expect(screen.getByTestId('module')).toHaveTextContent('none')
    expect(screen.getByTestId('stack-len')).toHaveTextContent('0')
  })

  it('backCanvas() on empty stack is a no-op', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    act(() => screen.getByText('back').click())
    expect(screen.getByTestId('module')).toHaveTextContent('none')
    expect(screen.getByTestId('stack-len')).toHaveTextContent('0')
  })

  it('closeCanvas() clears the whole stack', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    act(() => screen.getByText('open-programs').click())
    act(() => screen.getByText('open-ocems').click())
    act(() => screen.getByText('close').click())
    expect(screen.getByTestId('module')).toHaveTextContent('none')
    expect(screen.getByTestId('stack-len')).toHaveTextContent('0')
  })

  it('canvasState is a derived view of the top of the stack', () => {
    render(<Wrapper><CanvasProbe /></Wrapper>)
    act(() => screen.getByText('open-programs').click())
    // canvasState.module should equal the top of the stack
    expect(screen.getByTestId('module')).toHaveTextContent('OPEN_PROGRAMS')
    act(() => screen.getByText('open-ocems').click())
    expect(screen.getByTestId('module')).toHaveTextContent('OPEN_OCEMS_LIVE_GRID')
  })
})
