import { timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'

function isLikelyBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)
}

export function isAdminCredentialConfigValid(): boolean {
  const expectedUser = process.env.ADMIN_USERNAME?.trim() || ''
  const expectedPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim() || ''

  if (!expectedUser || !expectedPasswordHash) return false
  return isLikelyBcryptHash(expectedPasswordHash)
}

export function validateAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME?.trim()
  const expectedPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim()

  if (!expectedUser || !expectedPasswordHash) return false
  if (!isLikelyBcryptHash(expectedPasswordHash)) return false
  if (username.length !== expectedUser.length) return false

  try {
    const userMatch = timingSafeEqual(
      Buffer.from(username), Buffer.from(expectedUser)
    )
    if (!userMatch) return false

    const passMatch = bcrypt.compareSync(password, expectedPasswordHash)
    return userMatch && passMatch
  } catch {
    return false
  }
}
