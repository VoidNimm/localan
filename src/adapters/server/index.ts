export * from './types'
export * from './webServerLauncher'
export * from './tauriServerLauncher'

import { isTauriEnvironment } from '../runtime'
import { webServerLauncher } from './webServerLauncher'
import { tauriServerLauncher } from './tauriServerLauncher'
import type { ServerCheckResult, ServerLauncherAdapter } from './types'

export const serverLauncher: ServerLauncherAdapter = {
  checkRembgStatus(): Promise<ServerCheckResult> {
    const active = isTauriEnvironment() ? tauriServerLauncher : webServerLauncher
    return active.checkRembgStatus()
  },
  checkOllamaStatus(): Promise<ServerCheckResult> {
    const active = isTauriEnvironment() ? tauriServerLauncher : webServerLauncher
    return active.checkOllamaStatus()
  },
  startRembgServer(): Promise<boolean> {
    const active = isTauriEnvironment() ? tauriServerLauncher : webServerLauncher
    if (active.startRembgServer) {
      return active.startRembgServer()
    }
    return Promise.resolve(false)
  },
  stopRembgServer(): Promise<boolean> {
    const active = isTauriEnvironment() ? tauriServerLauncher : webServerLauncher
    if (active.stopRembgServer) {
      return active.stopRembgServer()
    }
    return Promise.resolve(false)
  },
}
