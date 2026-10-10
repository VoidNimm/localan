import { httpClient } from '../adapters/http'
import { isTauriEnvironment } from '../adapters/runtime'

function getOllamaEndpoints(path: string): string[] {
  if (isTauriEnvironment()) {
    return [`http://127.0.0.1:11434${path}`]
  }
  return [`/api/ollama${path}`, `http://127.0.0.1:11434${path}`]
}

export interface OllamaModelInfo {

  name: string
  model: string
  label: string
  description: string
  sizeBytes?: number
  parameterSize?: string
}

// Fallback models when Ollama is offline or loading
export const DEFAULT_MODELS: OllamaModelInfo[] = [
  {
    name: 'gemma4:e2b',
    model: 'gemma4:e2b',
    label: 'Fast for answering',
    description: 'Ringan, responsif, dan hemat memori (4.6B parameter)',
    parameterSize: '4.6B',
  },
  {
    name: 'gemma4:12b',
    model: 'gemma4:12b',
    label: 'Deep reasoning & analysis',
    description: 'Penalaran mendalam untuk tugas kompleks (11.9B parameter)',
    parameterSize: '11.9B',
  },
  {
    name: 'qwen3.5:9b',
    model: 'qwen3.5:9b',
    label: 'Multilingual & code precision',
    description: 'Presisi tinggi untuk kode & multi-bahasa (9.7B parameter)',
    parameterSize: '9.7B',
  },
]

function getLabelForModel(name: string, paramSize?: string): { label: string; description: string } {
  const lower = name.toLowerCase()
  if (lower.includes('32b') || lower.includes('70b')) {
    return {
      label: 'Maximum precision & depth',
      description: `Model skala besar (${paramSize || '30B+'})`,
    }
  }
  if (lower.includes('12b') || lower.includes('14b') || lower.includes('13b')) {
    return {
      label: 'Deep reasoning & analysis',
      description: `Kemampuan analitis tinggi (${paramSize || '12B'})`,
    }
  }
  if (lower.includes('9b') || lower.includes('8b') || lower.includes('7b')) {
    return {
      label: 'Multilingual & code precision',
      description: `Seimbang & serbaguna (${paramSize || '8-9B'})`,
    }
  }
  if (lower.includes('e2b') || lower.includes('2b')) {
    return {
      label: 'Fast for answering',
      description: `Cepat & efisien (${paramSize || '2B'})`,
    }
  }

  return {
    label: paramSize ? `Model ${paramSize}` : 'Local LLM',
    description: 'Model lokal Ollama',
  }
}

interface OllamaApiTagItem {
  name: string
  model?: string
  size?: number
  details?: {
    parameter_size?: string
  }
}

import { logDiagnostic } from '../utils/diagnostic'

export async function fetchOllamaModels(): Promise<{ models: OllamaModelInfo[]; isConnected: boolean }> {
  const endpoints = getOllamaEndpoints('/api/tags')
  logDiagnostic('OLLAMA:fetchOllamaModels:start', { endpoints })


  for (const endpoint of endpoints) {
    try {
      logDiagnostic('OLLAMA:fetchOllamaModels:try_endpoint', { endpoint })
      const controller = new AbortController()
      const timer = setTimeout(() => {
        logDiagnostic('OLLAMA:fetchOllamaModels:timeout_fired', { endpoint })
        controller.abort()
      }, 2000)
      const res = await httpClient.fetch(endpoint, { signal: controller.signal })
      clearTimeout(timer)
      logDiagnostic('OLLAMA:fetchOllamaModels:response_received', { endpoint, ok: res.ok, status: res.status })

      if (res.ok) {
        const data = await res.json()
        logDiagnostic('OLLAMA:fetchOllamaModels:data_parsed', { endpoint, isArray: Array.isArray(data.models), count: data.models?.length })
        if (Array.isArray(data.models) && data.models.length > 0) {
          const rawModels = data.models as OllamaApiTagItem[]
          const mapped: OllamaModelInfo[] = rawModels.map((m) => {
            const paramSize = m.details?.parameter_size || ''
            const info = getLabelForModel(m.name, paramSize)
            return {
              name: m.name,
              model: m.model || m.name,
              label: info.label,
              description: info.description,
              sizeBytes: m.size,
              parameterSize: paramSize,
            }
          })
          logDiagnostic('OLLAMA:fetchOllamaModels:SUCCESS_CONNECTED', { count: mapped.length })
          return { models: mapped, isConnected: true }
        }
      }
    } catch (err: any) {
      logDiagnostic('OLLAMA:fetchOllamaModels:catch_error', {
        endpoint,
        errName: err?.name,
        errMsg: err?.message,
        stack: err?.stack,
      })
    }
  }

  logDiagnostic('OLLAMA:fetchOllamaModels:FAILED_DISCONNECTED', { fallbackCount: DEFAULT_MODELS.length })
  return { models: DEFAULT_MODELS, isConnected: false }
}


export interface ModelCapabilities {
  hasThinking: boolean
  isGptOss: boolean
  hasTools: boolean
}

const capabilitiesCache = new Map<string, ModelCapabilities | null>()

export async function fetchModelCapabilities(modelName: string): Promise<ModelCapabilities | null> {
  if (capabilitiesCache.has(modelName)) {
    return capabilitiesCache.get(modelName) || null
  }
  
  const endpoints = getOllamaEndpoints('/api/show')

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const res = await httpClient.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
        signal: controller.signal
      })
      clearTimeout(timer)

      if (res.ok) {
        const data = await res.json()
        
        const apiCaps = Array.isArray(data.capabilities) ? data.capabilities : []
        const familyStr = JSON.stringify(data.details?.families || [])
        const infoStr = JSON.stringify(data.model_info || {})
        const hasTools =
          apiCaps.includes('tools') ||
          familyStr.includes('tool') ||
          infoStr.includes('tool') ||
          modelName.includes('qwen') ||
          modelName.includes('gemma') ||
          modelName.includes('llama3')
        
        const caps: ModelCapabilities = {
          hasThinking: true,
          isGptOss: modelName.toLowerCase().includes('gpt-oss') || modelName.toLowerCase().includes('gpt_oss'),
          hasTools
        }
        capabilitiesCache.set(modelName, caps)
        return caps
      }
    } catch {
      // try next endpoint
    }
  }
  const fallbackCaps: ModelCapabilities = {
    hasThinking: true,
    isGptOss: modelName.toLowerCase().includes('gpt-oss') || modelName.toLowerCase().includes('gpt_oss'),
    hasTools: true
  }
  capabilitiesCache.set(modelName, fallbackCaps)
  return fallbackCaps
}
import type { FileAttachment } from '../utils/fileReader'
export type { FileAttachment }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  thinking?: string
  thinkingDurationMs?: number
  timestamp: number
  model?: string
  attachments?: FileAttachment[]
  tool_calls?: ToolCall[]
  tool_name?: string
  tool_status?: string
  tool_diff?: any
  tool_result?: any
  tool_error?: string
}

export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  images?: string[]
  tool_calls?: ToolCall[]
  tool_name?: string
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export type ChatEvent = 
  | { type: 'thinking'; content: string } 
  | { type: 'content'; content: string }
  | { type: 'tool_calls'; tool_calls: ToolCall[] };

// Kept for backward compatibility
export async function* streamOllamaChat(
  model: string,
  messages: OllamaChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const stream = streamOllamaChatWithEvents(model, messages, {}, signal)
  for await (const event of stream) {
    if (event.type === 'content') {
      yield event.content
    }
  }
}

export class OllamaError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = 'OllamaError';
    this.status = status;
    this.body = body;
  }
}

export async function* streamOllamaChatWithEvents(
  model: string,
  messages: OllamaChatMessage[],
  options?: { think?: boolean | 'low' | 'medium' | 'high'; tools?: any[] },
  signal?: AbortSignal
): AsyncGenerator<ChatEvent, void, unknown> {
  const endpoints = getOllamaEndpoints('/api/chat')

  let connected = false
  let lastError: Error | null = null;
  let lastStatus: number | undefined;
  let lastBody: string | undefined;

  for (const endpoint of endpoints) {
    try {
      const bodyPayload: any = {
          model,
          messages,
          stream: true,
          ...(options?.think !== undefined ? { think: options.think } : {})
      };
      if (options?.tools && options.tools.length > 0) {
        bodyPayload.tools = options.tools;
      }
      
      const res = await httpClient.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal,
      })

      const stream = res.bodyStream()
      if (res.ok && stream) {
        connected = true
        const decoder = new TextDecoder()
        let buffer = ''

        if ('getReader' in (stream as any)) {
          const reader = (stream as ReadableStream<Uint8Array>).getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                const parsed = JSON.parse(trimmed)
                if (parsed.message) {
                  if (parsed.message.thinking) {
                    yield { type: 'thinking', content: parsed.message.thinking }
                  }
                  if (parsed.message.content) {
                    yield { type: 'content', content: parsed.message.content }
                  }
                  if (parsed.message.tool_calls && parsed.message.tool_calls.length > 0) {
                    yield { type: 'tool_calls', tool_calls: parsed.message.tool_calls }
                  }
                }
              } catch {
                // ignore malformed JSON chunk
              }
            }
          }
        } else {
          for await (const chunk of (stream as AsyncIterable<Uint8Array>)) {
            buffer += decoder.decode(chunk, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                const parsed = JSON.parse(trimmed)
                if (parsed.message) {
                  if (parsed.message.thinking) {
                    yield { type: 'thinking', content: parsed.message.thinking }
                  }
                  if (parsed.message.content) {
                    yield { type: 'content', content: parsed.message.content }
                  }
                  if (parsed.message.tool_calls && parsed.message.tool_calls.length > 0) {
                    yield { type: 'tool_calls', tool_calls: parsed.message.tool_calls }
                  }
                }
              } catch {
                // ignore malformed JSON chunk
              }
            }
          }
        }
        return
      } else {
        lastStatus = res.status;
        lastBody = await res.text().catch(() => '');
        console.error('Ollama API error', { status: lastStatus, body: lastBody, payload: bodyPayload });
        lastError = new OllamaError(`Ollama API error: ${res.statusText}`, res.status, lastBody);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      lastError = err;
    }
  }

  if (!connected) {
    const isMockEnabled = import.meta.env.VITE_OLLAMA_MOCK === 'true';
    if (!isMockEnabled) {
      if (lastError) throw lastError;
      throw new OllamaError('Failed to connect to any Ollama endpoint');
    }

    const isMockSimulatingThinking = options?.think !== false;
    
    // Graceful offline mock streaming response
    const lastUserMsgObj = messages[messages.length - 1]
    const lastUserMsg = lastUserMsgObj?.content || 'Halo'
    const hasImages = Boolean(lastUserMsgObj?.images && lastUserMsgObj.images.length > 0)
    const hasFileAttachment = lastUserMsg.includes('[File Lampiran:') || lastUserMsg.includes('[Isi Dokumen')

    let chosen: string
    if (hasImages) {
      chosen = `Saya telah memproses gambar yang Anda lampirkan dengan model **${model}**.\n\nDalam mode lokal simulasi ini:\n- **Deteksi Citra**: Citra base64 berhasil diterima dan siap dikirimkan ke model multimodal.\n- **Analisis Visual**: Citra telah terdaftar di memori konteks sesi saat ini.\n\n*Tips*: Bila Ollama Anda sedang aktif, pastikan menggunakan model berkemampuan Vision!`
    } else if (hasFileAttachment) {
      const fileMatch = /\[(?:File Lampiran|Isi Dokumen[^:]*):\s*([^\]]+)\]/.exec(lastUserMsg)
      const fileName = fileMatch ? fileMatch[1].trim() : 'dokumen Anda'
      chosen = `Saya telah membaca dan menganalisis seluruh isi file **${fileName}** yang Anda lampirkan.\n\nBerikut ringkasan hasil pembacaan:\n1. **Struktur Konten**: Berhasil diparsing dan dimuat ke dalam *context window* model **${model}**.\n2. **Kesiapan Diskusi**: Anda dapat meminta saya untuk menjelaskan kode/teks atau mencari bug.\n\nAda bagian spesifik yang ingin ditelaah?`
    } else {
      const mockResponses = [
        `Halo! Saya berjalan melalui **${model}** secara lokal di komputer Anda.\n\nSemua proses inferensi dan data percakapan Anda **100% tersimpan di perangkat lokal** tanpa dikirim ke server cloud mana pun.\n\nAnda bertanya:\n> "${lastUserMsg}"\n\nAda hal spesifik yang ingin didiskusikan?`,
        `Tentu, mari kita bahas ini dengan model **${model}**.\n\n1. **Kerahasiaan Data Penuh**: Tidak ada telemetri.\n2. **Kinerja Rendah Latensi**: Diproses langsung secara lokal.\n3. **Kustomisasi**: Anda bebas mengganti model.\n\nSilakan lanjutkan jika ada pertanyaan tambahan!`,
      ]
      chosen = mockResponses[Math.floor(Math.random() * mockResponses.length)]
    }

    chosen = '[Mode simulasi] ' + chosen;

    if (isMockSimulatingThinking) {
      yield { type: 'thinking', content: 'Memulai mode simulasi offline...' }
      await new Promise(r => setTimeout(r, 400))
      yield { type: 'thinking', content: '\nMengevaluasi fallback respons.' }
      await new Promise(r => setTimeout(r, 600))
    }

    const words = chosen.split(' ')
    for (let i = 0; i < words.length; i++) {
      if (signal?.aborted) return
      yield { type: 'content', content: (i === 0 ? '' : ' ') + words[i] }
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 20))
    }
  }
}
