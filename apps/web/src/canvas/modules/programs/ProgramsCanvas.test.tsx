import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// We test the handleCardClick logic in isolation by mocking useChat and useAuth
vi.mock('../../../context/ChatContext.js', () => ({
  useChat: vi.fn(),
}))
vi.mock('../../../context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../../../context/AppContext.js', () => ({
  useApp: vi.fn(),
}))
vi.mock('../../../lib/api.js', () => ({
  api: vi.fn(),
}))

import { useChat } from '../../../context/ChatContext.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'
import { ProgramsCanvas } from './ProgramsCanvas.js'

const mockOpenCanvas = vi.fn()
const mockShowToast = vi.fn()

const makeProgram = (overrides: Partial<{
  id: string; name: string; fullName: string; canvasId: string;
  stationCount: number; activeStationCount: number;
  currentExceedancesCount: number; recentAnomalyCount30d: number;
}>) => ({
  id: 'OCEMS',
  name: 'OCEMS',
  fullName: 'Online Continuous Effluent Monitoring System',
  canvasId: 'OPEN_OCEMS_LIVE_GRID',
  stationCount: 10,
  activeStationCount: 8,
  currentExceedancesCount: 2,
  recentAnomalyCount30d: 5,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ token: 'tok' })
  ;(useChat as ReturnType<typeof vi.fn>).mockReturnValue({
    openCanvas: mockOpenCanvas,
  })
  ;(useApp as ReturnType<typeof vi.fn>).mockReturnValue({
    showToast: mockShowToast,
  })
})

describe('ProgramsCanvas card clicks', () => {
  it('calls openCanvas with the canvasId from the program when card is clicked', async () => {
    ;(api as ReturnType<typeof vi.fn>).mockResolvedValue({
      programs: [makeProgram({ id: 'OCEMS', canvasId: 'OPEN_OCEMS_LIVE_GRID' })],
    })

    render(<ProgramsCanvas />)
    // Wait for the programs to load
    const card = await screen.findByRole('button', { name: /OCEMS/i })
    act(() => card.click())

    expect(mockOpenCanvas).toHaveBeenCalledWith('OPEN_OCEMS_LIVE_GRID', {})
    // No sendMessage should have been called
  })

  it('calls openCanvas with stationType arg for WATER program', async () => {
    ;(api as ReturnType<typeof vi.fn>).mockResolvedValue({
      programs: [makeProgram({
        id: 'WATER',
        name: 'Water Quality',
        canvasId: 'OPEN_TREND_LAB',
        stationCount: 20,
        activeStationCount: 18,
      })],
    })

    render(<ProgramsCanvas />)
    const card = await screen.findByRole('button', { name: /Water Quality/i })
    act(() => card.click())

    expect(mockOpenCanvas).toHaveBeenCalledWith('OPEN_TREND_LAB', { stationType: 'MINARS' })
  })

  it('does NOT call openCanvas for NOISE placeholder — shows toast instead', async () => {
    ;(api as ReturnType<typeof vi.fn>).mockResolvedValue({
      programs: [makeProgram({
        id: 'NOISE',
        name: 'Noise',
        canvasId: '',
        stationCount: 0,
        activeStationCount: 0,
        currentExceedancesCount: 0,
        recentAnomalyCount30d: 0,
      })],
    })

    render(<ProgramsCanvas />)
    const card = await screen.findByRole('button', { name: /Noise/i })
    act(() => card.click())

    expect(mockOpenCanvas).not.toHaveBeenCalled()
  })

  it('does NOT call openCanvas for HAZARDOUS_WASTE placeholder', async () => {
    ;(api as ReturnType<typeof vi.fn>).mockResolvedValue({
      programs: [makeProgram({
        id: 'HAZARDOUS_WASTE',
        name: 'Hazardous Waste',
        canvasId: '',
        stationCount: 0,
        activeStationCount: 0,
        currentExceedancesCount: 0,
        recentAnomalyCount30d: 0,
      })],
    })

    render(<ProgramsCanvas />)
    const card = await screen.findByRole('button', { name: /Hazardous Waste/i })
    act(() => card.click())

    expect(mockOpenCanvas).not.toHaveBeenCalled()
  })

  it('calls openCanvas for FESTIVAL (has a real canvasId)', async () => {
    ;(api as ReturnType<typeof vi.fn>).mockResolvedValue({
      programs: [makeProgram({
        id: 'FESTIVAL',
        name: 'Festival Monitoring',
        canvasId: 'OPEN_FESTIVAL_PLANNER',
        stationCount: 0,
        activeStationCount: 0,
        currentExceedancesCount: 0,
        recentAnomalyCount30d: 0,
      })],
    })

    render(<ProgramsCanvas />)
    const card = await screen.findByRole('button', { name: /Festival Monitoring/i })
    act(() => card.click())

    expect(mockOpenCanvas).toHaveBeenCalledWith('OPEN_FESTIVAL_PLANNER', {})
  })
})
