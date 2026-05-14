import { EventEmitter } from 'events'

export const eventBus = new EventEmitter()

// Event name constants — modules publish and subscribe via these keys only
export const Events = {
  PLAYLIST_GENERATED: 'playlist:generated',
  PLAYLIST_EXPORTED: 'playlist:exported',
  USER_SIGNAL_RECORDED: 'signal:recorded',
  SUBSCRIPTION_UPDATED: 'subscription:updated',
} as const
