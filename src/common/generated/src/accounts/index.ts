export * from './authorizedNativeSender'
export * from './giveOrderState'
export * from './nonceMaster'
export * from './state'

import { State } from './State'
import { GiveOrderState } from './GiveOrderState'
import { NonceMaster } from './NonceMaster'
import { AuthorizedNativeSender } from './AuthorizedNativeSender'

export const accountProviders = {
  State,
  GiveOrderState,
  NonceMaster,
  AuthorizedNativeSender,
}
