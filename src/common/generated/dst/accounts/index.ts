export * from './authorizedSrcContract'
export * from './state'
export * from './takeOrderPatch'
export * from './takeOrderState'

import { TakeOrderPatch } from './takeOrderPatch'
import { AuthorizedSrcContract } from './authorizedSrcContract'
import { TakeOrderState } from './takeOrderState'
import { State } from './state'

export const accountProviders = {
  TakeOrderPatch,
  AuthorizedSrcContract,
  TakeOrderState,
  State,
}
