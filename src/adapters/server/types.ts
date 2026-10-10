export interface ServerCheckResult {
  isOnline: boolean
  port: number
  error?: string
}

export type RembgLauncherState = 'idle' | 'memeriksa' | 'memulai' | 'berjalan' | 'gagal'

export interface RembgLauncherStatus {
  state: RembgLauncherState
  errorMessage?: string
  exitCode?: number | null
}

export interface ServerLauncherAdapter {
  checkRembgStatus(): Promise<ServerCheckResult>
  checkOllamaStatus(): Promise<ServerCheckResult>
  startRembgServer?(): Promise<boolean>
  stopRembgServer?(): Promise<boolean>
  getRembgStatus?(): RembgLauncherStatus
  onRembgStatusChange?(cb: (status: RembgLauncherStatus) => void): () => void
}

