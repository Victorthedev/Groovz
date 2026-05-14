import type {
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
  }
}
