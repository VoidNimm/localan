import { useState, useEffect, useCallback } from 'react'
import {
  fetchOllamaModels,
  fetchModelCapabilities,
  DEFAULT_MODELS,
  type OllamaModelInfo,
  type ModelCapabilities,
} from '../services/ollama'
import type { EffortLevel } from '../components/EffortPill'

export const STORAGE_KEY_SELECTED_MODEL = 'local_chat_selected_model_v1'
export const getStorageKeyEffort = (modelName: string) => `local_chat_effort_${modelName}`

export function useOllamaModels() {
  const [models, setModels] = useState<OllamaModelInfo[]>(DEFAULT_MODELS)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SELECTED_MODEL) || 'gemma4:e2b'
  })
  const [capabilities, setCapabilities] = useState<ModelCapabilities | null>(null)

  const getInitialEffort = useCallback((modelName: string, paramSize: string | undefined): EffortLevel => {
    const saved = localStorage.getItem(getStorageKeyEffort(modelName))
    if (saved) return saved as EffortLevel
    // Default rule: >= 10B defaults to 'none' because it's heavy and slow
    if (paramSize) {
      const match = paramSize.match(/([\d.]+)B/i)
      if (match && parseFloat(match[1]) >= 10) {
        return 'none'
      }
    }
    return 'none' // default to not sending think parameter to stick with Ollama defaults
  }, [])

  const [effort, setEffort] = useState<EffortLevel>(() => getInitialEffort(selectedModel, undefined))
  const [isOllamaConnected, setIsOllamaConnected] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Load models on mount or retry
  const loadModels = useCallback(async () => {
    const res = await fetchOllamaModels()
    setModels(res.models)
    setIsOllamaConnected(res.isConnected)
    if (!res.isConnected) {
      setErrorMessage('Ollama offline di port 11434')
    } else {
      setErrorMessage(null)
    }
    // Validate if current selected model still exists
    if (!res.models.some((m) => m.name === selectedModel)) {
      if (res.models[0]) {
        setSelectedModel(res.models[0].name)
      }
    }
  }, [selectedModel])

  useEffect(() => {
    let mounted = true
    fetchOllamaModels().then((res) => {
      if (!mounted) return
      setModels(res.models)
      setIsOllamaConnected(res.isConnected)
      if (!res.isConnected) {
        setErrorMessage('Ollama offline di port 11434')
      } else {
        setErrorMessage(null)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  // Lazy fetch capabilities when selectedModel changes
  useEffect(() => {
    let mounted = true
    fetchModelCapabilities(selectedModel).then((caps) => {
      if (!mounted) return
      setCapabilities(caps)
      if (caps && caps.hasThinking) {
        const modelInfo = models.find((m) => m.name === selectedModel)
        const initial = getInitialEffort(selectedModel, modelInfo?.parameterSize)
        setEffort(initial)
      }
    })
    return () => {
      mounted = false
    }
  }, [selectedModel, models, getInitialEffort])

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName)
    localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, modelName)
  }

  const handleEffortChange = (level: EffortLevel) => {
    setEffort(level)
    localStorage.setItem(getStorageKeyEffort(selectedModel), level)
  }

  return {
    models,
    setModels,
    selectedModel,
    setSelectedModel,
    capabilities,
    setCapabilities,
    effort,
    setEffort,
    isOllamaConnected,
    isModelLoading,
    setIsModelLoading,
    errorMessage,
    setErrorMessage,
    loadModels,
    handleSelectModel,
    handleEffortChange,
  }
}
