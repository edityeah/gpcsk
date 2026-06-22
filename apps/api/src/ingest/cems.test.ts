import { describe, it, expect } from 'vitest'
import { buildCuratedStations, type CuratedStation } from './cems.js'

describe('buildCuratedStations', () => {
  it('returns at least 50 stations', () => {
    const stations = buildCuratedStations()
    expect(stations.length).toBeGreaterThanOrEqual(50)
  })

  it('all stations are inside Gujarat bounding box', () => {
    const stations = buildCuratedStations()
    for (const s of stations) {
      expect(s.lat).toBeGreaterThanOrEqual(20.1)
      expect(s.lat).toBeLessThanOrEqual(24.8)
      expect(s.lng).toBeGreaterThanOrEqual(68.0)
      expect(s.lng).toBeLessThanOrEqual(74.5)
    }
  })

  it('all stations have at least one parameter', () => {
    const stations = buildCuratedStations()
    for (const s of stations) {
      expect(s.parameters.length).toBeGreaterThan(0)
    }
  })

  it('all station names include (CEMS) suffix', () => {
    const stations = buildCuratedStations()
    for (const s of stations) {
      expect(s.name).toMatch(/\(CEMS\)$/)
    }
  })
})
