export const AIR_PARAMETERS = [
  'PM10', 'PM2_5', 'SO2', 'NOx', 'NH3', 'O3', 'CO',
  'LEAD', 'ARSENIC', 'NICKEL', 'BENZENE', 'BENZO_A_PYRENE',
] as const
export type AirParameter = (typeof AIR_PARAMETERS)[number]

export const WATER_PARAMETERS = [
  'pH', 'DO', 'BOD', 'COD', 'SS', 'NH3_N',
  'PHENOLIC_COMPOUNDS', 'TURBIDITY', 'TDS', 'CONDUCTIVITY',
] as const
export type WaterParameter = (typeof WATER_PARAMETERS)[number]

export const VOC_PARAMETERS = [
  'METHANOL', 'ETHANOL', 'ACETONE', 'ISO_PROPYL_ALCOHOL',
  'METHYLENE_DI_CHLORIDE', 'BUTANOL', 'CHLOROFORM', 'CARBON_TETRA_CHLORIDE',
  'BENZENE', 'METHYL_ISOBUTYLKETONE', 'TOLUENE',
  'P_XYLENE', 'M_XYLENE', 'O_XYLENE',
  'ETHYL_METHYL_KETONE', 'BENZO_A_PYRENE',
] as const
export type VocParameter = (typeof VOC_PARAMETERS)[number]
