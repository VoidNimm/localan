import type { ServerCheckResult, ServerLauncherAdapter } from './types'

export class WebServerLauncher implements ServerLauncherAdapter {
  async checkRembgStatus(): Promise<ServerCheckResult> {
    const endpoints = ['/api/rembg', 'http://127.0.0.1:7000/api']
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3500)
        const res = await window.fetch(endpoint, {
          method: 'HEAD',
          signal: controller.signal,
        })
        clearTimeout(timer)
        if (res.ok || res.status === 200 || res.status === 307) {
          return { isOnline: true, port: 7000 }
        }
      } catch {
        // try next endpoint
      }
    }
    return { isOnline: false, port: 7000, error: 'Server rembg offline (port 7000)' }
  }

  async checkOllamaStatus(): Promise<ServerCheckResult> {
    const endpoints = ['/api/ollama/api/tags', 'http://127.0.0.1:11434/api/tags']
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 2000)
        const res = await window.fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timer)
        if (res.ok) {
          return { isOnline: true, port: 11434 }
        }
      } catch {
        // try next endpoint
      }
    }
    return { isOnline: false, port: 11434, error: 'Server Ollama offline (port 11434)' }
  }

  async startRembgServer(): Promise<boolean> {
    // Di lingkungan browser web, peluncuran proses OS lokal tidak didukung
    return false
  }

  async stopRembgServer(): Promise<boolean> {
    return false
  }
}

export const webServerLauncher = new WebServerLauncher()
