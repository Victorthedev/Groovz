import { prisma } from '../../shared/utils/prisma.js'

export interface PreferencesUpdate {
  defaultPlatform?: string
  defaultDuration?: number
  diversityBias?: number
  whatsappPhone?: string
}

export async function getPreferences(userId: string) {
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } })
  if (!prefs) throw Object.assign(new Error('Preferences not found'), { statusCode: 404 })
  return prefs
}

export async function updatePreferences(userId: string, update: PreferencesUpdate) {
  if (update.diversityBias !== undefined) {
    const caps = await prisma.userCapabilities.findUnique({ where: { userId } })
    if (!caps || caps.plan !== 'paid') {
      throw Object.assign(new Error('diversityBias tuning requires a paid plan'), { statusCode: 403 })
    }
  }

  return prisma.userPreferences.update({
    where: { userId },
    data: update,
  })
}

export async function getCapabilities(userId: string) {
  const caps = await prisma.userCapabilities.findUnique({ where: { userId } })
  if (!caps) throw Object.assign(new Error('Capabilities not found'), { statusCode: 404 })
  return caps
}
