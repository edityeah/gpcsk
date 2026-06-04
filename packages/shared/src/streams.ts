export const STREAMS = ['AIR', 'WATER', 'HAZARDOUS_WASTE', 'NOISE_MSW'] as const
export type Stream = (typeof STREAMS)[number]

export const STREAM_LABELS: Record<Stream, { en: string; gu: string }> = {
  AIR:             { en: 'Air',                       gu: 'હવા' },
  WATER:           { en: 'Water',                     gu: 'પાણી' },
  HAZARDOUS_WASTE: { en: 'Hazardous Waste',           gu: 'જોખમી કચરો' },
  NOISE_MSW:       { en: 'Noise / Municipal Waste',   gu: 'અવાજ / મ્યુનિસિપલ કચરો' },
}
