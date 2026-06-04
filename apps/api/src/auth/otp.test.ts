import { describe, it, expect } from 'vitest'
import { isValidDemoOtp } from './otp.js'

describe('isValidDemoOtp', () => {
  it.each(['1234', '123456'])('accepts %s', (otp) => {
    expect(isValidDemoOtp(otp)).toBe(true)
  })

  it.each(['0000', '12345', 'abcd', '', '1234 '])('rejects %s', (otp) => {
    expect(isValidDemoOtp(otp)).toBe(false)
  })
})
