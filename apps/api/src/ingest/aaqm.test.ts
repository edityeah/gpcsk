import { describe, it, expect } from 'vitest'
import { parseGujaratLocations, type OpenAQLocation } from './aaqm.js'

const SAMPLE_LOCATIONS: OpenAQLocation[] = [
  {
    id: 1001,
    name: 'Maninagar',
    locality: 'Ahmedabad',
    country: { code: 'IN', name: 'India' },
    coordinates: { latitude: 23.00, longitude: 72.59 },
    parameters: [
      { parametersId: 1, parameter: { name: 'pm25', displayName: 'PM2.5', units: 'µg/m³' }, lastValue: 35.2, lastUpdated: '2026-06-22T10:00:00Z' },
      { parametersId: 2, parameter: { name: 'pm10', displayName: 'PM10', units: 'µg/m³' }, lastValue: 68.1, lastUpdated: '2026-06-22T10:00:00Z' },
    ],
    providers: [{ sourceName: 'CPCB' }],
  },
  {
    id: 1002,
    name: 'Delhi Anand Vihar',
    locality: 'Delhi',
    country: { code: 'IN', name: 'India' },
    coordinates: { latitude: 28.64, longitude: 77.31 }, // outside Gujarat bbox
    parameters: [],
    providers: [{ sourceName: 'CPCB' }],
  },
  {
    id: 1003,
    name: 'Vapi',
    locality: 'Valsad',
    country: { code: 'IN', name: 'India' },
    coordinates: { latitude: 20.37, longitude: 72.91 },
    parameters: [
      { parametersId: 3, parameter: { name: 'so2', displayName: 'SO₂', units: 'µg/m³' }, lastValue: 15.0, lastUpdated: '2026-06-22T09:00:00Z' },
    ],
    providers: [{ sourceName: 'CPCB' }],
  },
]

describe('parseGujaratLocations', () => {
  it('filters locations inside Gujarat bounding box', () => {
    const result = parseGujaratLocations(SAMPLE_LOCATIONS)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.id)).toEqual([1001, 1003])
  })

  it('excludes locations outside bbox', () => {
    const result = parseGujaratLocations(SAMPLE_LOCATIONS)
    expect(result.find(r => r.name === 'Delhi Anand Vihar')).toBeUndefined()
  })

  it('maps parameter names to uppercase underscore format', () => {
    const result = parseGujaratLocations(SAMPLE_LOCATIONS)
    const maninagar = result.find(r => r.id === 1001)!
    expect(maninagar.parameters.map(p => p.paramKey)).toEqual(
      expect.arrayContaining(['PM2_5', 'PM10'])
    )
  })

  it('returns empty array for empty input', () => {
    expect(parseGujaratLocations([])).toHaveLength(0)
  })
})
