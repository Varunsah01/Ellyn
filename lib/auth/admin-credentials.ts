import { timingSafeEqual } from 'crypto'

export function validateAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME?.trim()
  const expectedPass = process.env.ADMIN_PASSWORD?.trim()

  if (!expectedUser || !expectedPass) return false
  if (username.length !== expectedUser.length) return false
  if (password.length !== expectedPass.length) return false

  try {
    const userMatch = timingSafeEqual(
      Buffer.from(username), Buffer.from(expectedUser)
    )
    const passMatch = timingSafeEqual(
      Buffer.from(password), Buffer.from(expectedPass)
    )
    return userMatch && passMatch
  } catch {
    return false
  }
}
