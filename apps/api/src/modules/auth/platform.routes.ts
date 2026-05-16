import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as platformService from './platform.service.js'
import { SUPPORTED_PLATFORMS } from './platform.config.js'
import { signOAuthState, verifyOAuthState } from './tokens.js'

const platformParam = z.enum(SUPPORTED_PLATFORMS)

export async function registerPlatformRoutes(fastify: FastifyInstance) {
  // Initiate OAuth — authenticated user only
  fastify.post(
    '/platforms/connect',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({ platform: platformParam }).safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid platform' })

      const authUrl = await platformService.getOAuthUrl(
        body.data.platform,
        request.user.userId,
        (uid, plat) => signOAuthState(uid, plat, fastify),
      )
      return reply.send({ authUrl })
    },
  )

  // OAuth callback — no auth header (comes from the platform's redirect)
  fastify.get('/platforms/callback/:platform', async (request, reply) => {
    const params = z
      .object({ platform: platformParam })
      .safeParse((request.params as Record<string, string>))
    const query = z
      .object({ code: z.string(), state: z.string() })
      .safeParse(request.query)

    if (!params.success || !query.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    await platformService.handleOAuthCallback(
      params.data.platform,
      query.data.code,
      query.data.state,
      (state) => verifyOAuthState(state, fastify),
    )

    // Redirect the user back to the web app
    const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3000'
    return reply.redirect(`${webBase}/connect-success?platform=${params.data.platform}`)
  })

  // Fetch user's library from a connected platform.
  // ?platform=spotify                    → liked songs + playlists list
  // ?platform=spotify&playlistId={id}    → tracks from a specific playlist
  fastify.get(
    '/platforms/library',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = z
        .object({
          platform: platformParam,
          playlistId: z.string().optional(),
        })
        .safeParse(request.query)
      if (!query.success) return reply.status(400).send({ error: 'Invalid platform' })

      const { platform, playlistId } = query.data

      if (playlistId) {
        const tracks = await platformService.getPlaylistTracks(request.user.userId, platform, playlistId)
        return reply.send({ tracks })
      }

      const data = await platformService.getLibrary(request.user.userId, platform)
      return reply.send(data)
    },
  )

  // List connected platforms — used by Profile screen
  fastify.get(
    '/platforms/connected',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const platforms = await platformService.getConnectedPlatforms(request.user.userId)
      return reply.send({ platforms })
    },
  )

  // Disconnect a platform
  fastify.delete(
    '/platforms/:platform',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const params = z
        .object({ platform: platformParam })
        .safeParse(request.params)
      if (!params.success) return reply.status(400).send({ error: 'Invalid platform' })

      await platformService.disconnectPlatform(request.user.userId, params.data.platform)
      return reply.status(204).send()
    },
  )
}
