import type { FastifyInstance } from 'fastify'
import { prisma } from '../../shared/utils/prisma.js'

export async function registerAdminRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.get('/admin/stats', auth, async (request, reply) => {
    const ownerEmail = process.env.OWNER_EMAIL
    if (!ownerEmail) return reply.status(403).send({ error: 'Admin not configured' })

    const requester = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { email: true },
    })
    if (!requester || requester.email !== ownerEmail) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const now         = new Date()
    const ago7        = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const ago30       = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      newUsers7,
      newUsers30,
      totalPlaylists,
      playlists7,
      playlists30,
      byType,
      byPlatform,
      avgDuration,
      activeUsers7raw,
      activeUsers30raw,
      totalPaid,
      totalFree,
      blendSessions,
      blendSessions30,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: ago7 } } }),
      prisma.user.count({ where: { createdAt: { gte: ago30 } } }),
      prisma.playlistRecord.count(),
      prisma.playlistRecord.count({ where: { createdAt: { gte: ago7 } } }),
      prisma.playlistRecord.count({ where: { createdAt: { gte: ago30 } } }),
      prisma.playlistRecord.groupBy({ by: ['generationType'], _count: { id: true } }),
      prisma.playlistRecord.groupBy({ by: ['platform'], _count: { id: true } }),
      prisma.playlistRecord.aggregate({ _avg: { durationMinutes: true } }),
      prisma.playlistRecord.findMany({
        where: { createdAt: { gte: ago7 } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.playlistRecord.findMany({
        where: { createdAt: { gte: ago30 } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.userCapabilities.count({ where: { plan: 'paid' } }),
      prisma.userCapabilities.count({ where: { plan: 'free' } }),
      // Count distinct blend sessions by blendSessionId
      prisma.playlistRecord.findMany({
        where: { generationType: 'blend', blendSessionId: { not: null } },
        select: { blendSessionId: true },
        distinct: ['blendSessionId'],
      }),
      prisma.playlistRecord.findMany({
        where: { generationType: 'blend', blendSessionId: { not: null }, createdAt: { gte: ago30 } },
        select: { blendSessionId: true },
        distinct: ['blendSessionId'],
      }),
    ])

    const playlistsByType = Object.fromEntries(
      byType.map(r => [r.generationType, r._count.id]),
    )
    const playlistsByPlatform = Object.fromEntries(
      byPlatform.map(r => [r.platform, r._count.id]),
    )

    return reply.send({
      users: {
        total:       totalUsers,
        new7Days:    newUsers7,
        new30Days:   newUsers30,
        active7Days:  activeUsers7raw.length,
        active30Days: activeUsers30raw.length,
      },
      playlists: {
        total:       totalPlaylists,
        last7Days:   playlists7,
        last30Days:  playlists30,
        avgDurationMinutes: Math.round(avgDuration._avg.durationMinutes ?? 0),
        byType:      playlistsByType,
        byPlatform:  playlistsByPlatform,
      },
      blend: {
        totalSessions:    blendSessions.length,
        sessions30Days:   blendSessions30.length,
      },
      routes: {
        total: 0, last30Days: 0,
        byActivity: { drive: 0, walk: 0, jog: 0, cycle: 0 },
      },
      subscriptions: {
        paid: totalPaid,
        free: totalFree,
      },
    })
  })
}
