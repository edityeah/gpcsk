const VALID = new Set(['1234', '123456'])

export function isValidDemoOtp(otp: string): boolean {
  return VALID.has(otp)
}
