import { Command, type Child } from '@tauri-apps/plugin-shell'
import { resolveResource } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import { httpClient } from '../http'
import type { ServerCheckResult, ServerLauncherAdapter, RembgLauncherStatus } from './types'

export class TauriServerLauncher implements ServerLauncherAdapter {
  private rembgChild: Child | null = null
  private status: RembgLauncherStatus = { state: 'idle' }
  private listeners = new Set<(status: RembgLauncherStatus) => void>()
  private capturedStderr: string[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      ;(window as any).__tauriServerLauncher = this
      window.addEventListener('beforeunload', () => {
        void this.stopRembgServer()
      })
    }
  }

  getRembgStatus(): RembgLauncherStatus {
    return this.status
  }

  onRembgStatusChange(cb: (status: RembgLauncherStatus) => void): () => void {
    this.listeners.add(cb)
    cb(this.status)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private setStatus(newStatus: RembgLauncherStatus) {
    this.status = newStatus
    for (const listener of this.listeners) {
      try {
        listener(newStatus)
      } catch (err) {
        console.error('Error in rembg status listener:', err)
      }
    }
  }

  async checkRembgStatus(): Promise<ServerCheckResult> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2500)
      const res = await httpClient.fetch('http://127.0.0.1:7000/api', {
        method: 'HEAD',
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res.ok || res.status === 200 || res.status === 307) {
        return { isOnline: true, port: 7000 }
      }
    } catch {
      // offline
    }
    return { isOnline: false, port: 7000, error: 'Server rembg offline (port 7000)' }
  }

  async checkOllamaStatus(): Promise<ServerCheckResult> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const res = await httpClient.fetch('http://127.0.0.1:11434/api/tags', {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res.ok) {
        return { isOnline: true, port: 11434 }
      }
    } catch {
      // offline
    }
    return { isOnline: false, port: 11434, error: 'Server Ollama offline (port 11434)' }
  }

  async startRembgServer(forcePythonDirect = false): Promise<boolean> {
    this.capturedStderr = []
    this.setStatus({ state: 'memeriksa' })

    // Cek apakah server sudah online terlebih dahulu
    const initialCheck = await this.checkRembgStatus()
    if (initialCheck.isOnline) {
      this.setStatus({ state: 'berjalan' })
      return true
    }

    this.setStatus({ state: 'memulai' })
    let processExitedEarly = false
    let exitCodeEarly: number | null = null

    try {
      let cmd: Command<any> | null = null
      const forcePython =
        forcePythonDirect ||
        (typeof window !== 'undefined' && Boolean((window as any).__FORCE_REMBG_PYTHON_FALLBACK))

      // 1. Coba spawn start_rembg.bat via cmd dengan path ter-resolve (kecuali jika force direct python)
      if (!forcePython) {
        try {
          let batPath = 'start_rembg.bat'
          try {
            batPath = await resolveResource('start_rembg.bat')
          } catch {
            // fallback jika resolveResource gagal
          }
          cmd = Command.create('start_rembg_bat', ['/c', batPath])
        } catch (batErr) {
          console.warn('Gagal menyiapkan start_rembg.bat, mencoba fallback python:', batErr)
        }
      }

      // 2. Fallback jika bat command gagal dibuat atau direct python dipaksa
      if (!cmd) {
        let pyPath = 'scripts/run_rembg.py'
        try {
          pyPath = await resolveResource('scripts/run_rembg.py')
        } catch {
          // fallback
        }
        cmd = Command.create('run_rembg_python', [
          pyPath,
          '--host',
          '127.0.0.1',
          '--port',
          '7000',
          '--vram-limit-mb',
          '2048',
          '--no-ui',
        ])
      }

      // Pasang listener event untuk menangkap exit code dan error
      cmd.on('close', (data) => {
        console.log(`[Rembg process closed] code: ${data.code}, signal: ${data.signal}`)
        if (this.rembgChild?.pid) {
          void invoke('unregister_child_pid', { pid: this.rembgChild.pid }).catch(() => {})
        }
        this.rembgChild = null

        if (data.code !== 0 && data.code !== null) {
          processExitedEarly = true
          exitCodeEarly = data.code
          const stderrSummary = this.capturedStderr.slice(-3).join('\n')
          const msg = `Server berhenti dengan exit code ${data.code}.${stderrSummary ? ` Error: ${stderrSummary}` : ' Pastikan Python terpasang di PATH sistem.'}`
          this.setStatus({
            state: 'gagal',
            exitCode: data.code,
            errorMessage: msg,
          })
        }
      })

      cmd.on('error', (err) => {
        console.error('[Rembg process error]:', err)
        if (this.rembgChild?.pid) {
          void invoke('unregister_child_pid', { pid: this.rembgChild.pid }).catch(() => {})
        }
        this.rembgChild = null
        processExitedEarly = true
        this.setStatus({
          state: 'gagal',
          errorMessage: `Gagal meluncurkan proses: ${String(err)}`,
        })
      })

      cmd.stderr.on('data', (line) => {
        const text = String(line).trim()
        if (text) {
          console.warn('[Rembg stderr]:', text)
          this.capturedStderr.push(text)
        }
      })

      this.rembgChild = await cmd.spawn()
      console.log('[Rembg spawned] PID:', this.rembgChild.pid)

      // Daftarkan PID ke state Rust agar aman ditutup saat aplikasi keluar
      if (this.rembgChild.pid) {
        try {
          await invoke('register_child_pid', { pid: this.rembgChild.pid })
        } catch (regErr) {
          console.warn('Gagal mendaftarkan child PID ke Rust state:', regErr)
        }
      }

      // Polling health check hingga online (maksimal 25 detik)
      const maxAttempts = 25
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (processExitedEarly) {
          return false
        }
        await new Promise((r) => setTimeout(r, 1000))
        if (processExitedEarly) {
          return false
        }

        const check = await this.checkRembgStatus()
        if (check.isOnline) {
          this.setStatus({ state: 'berjalan' })
          return true
        }
      }

      // Jika timeout, hentikan proses anak dan unregister agar port bersih
      if (this.rembgChild?.pid) {
        const pid = this.rembgChild.pid
        void invoke('kill_child_process_tree_command', { pid }).catch(() => {})
        this.rembgChild = null
      }

      const errMsg =
        'Server rembg tidak merespons setelah 25 detik. ' +
        (this.capturedStderr.length > 0 ? this.capturedStderr.slice(-2).join(' ') : 'Silakan periksa terminal atau dependensi rembg.')
      this.setStatus({
        state: 'gagal',
        exitCode: exitCodeEarly,
        errorMessage: errMsg,
      })
      return false
    } catch (err: any) {
      console.error('Gagal menjalankan server rembg di Tauri:', err)
      if (this.rembgChild?.pid) {
        const pid = this.rembgChild.pid
        void invoke('kill_child_process_tree_command', { pid }).catch(() => {})
        this.rembgChild = null
      }
      this.setStatus({
        state: 'gagal',
        errorMessage: `Eksepsi spawn: ${err?.message || String(err)}`,
      })
      return false
    }
  }

  async stopRembgServer(): Promise<boolean> {
    if (this.rembgChild) {
      const pid = this.rembgChild.pid
      try {
        if (pid) {
          await invoke('kill_child_process_tree_command', { pid }).catch(async () => {
            await this.rembgChild?.kill().catch(() => {})
          })
        } else {
          await this.rembgChild.kill().catch(() => {})
        }
        this.rembgChild = null
        this.setStatus({ state: 'idle' })
        return true
      } catch (err) {
        console.warn('Gagal menghentikan proses rembg:', err)
        return false
      }
    }
    this.setStatus({ state: 'idle' })
    return true
  }
}

export const tauriServerLauncher = new TauriServerLauncher()
