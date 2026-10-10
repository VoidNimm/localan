import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, User, AlertCircle, RefreshCw, FileText, Code2, ShieldAlert, FilePlus, FileEdit, Trash2, Undo2, Sparkles } from 'lucide-react'
import type { ChatMessage, FileAttachment } from '../services/ollama'
import { formatFileSize, isCodeFile } from '../utils/fileReader'
import { ThinkingIndicator, ReasoningBlock } from './ThinkingIndicator'

interface ChatFeedProps {
  messages: ChatMessage[]
  isGenerating: boolean
  isModelLoading?: boolean
  currentModelName: string
  errorMessage?: string | null
  onRetry?: () => void
  onOpenRemoveBg?: (attachment: FileAttachment) => void
}

interface ParsedMessageContent {
  thinking: string | null
  isThinkingComplete: boolean
  content: string
}

function parseThinkingContent(rawText: string, providedThinking?: string): ParsedMessageContent {
  if (providedThinking !== undefined) {
    return {
      thinking: providedThinking || null,
      isThinkingComplete: true,
      content: rawText,
    }
  }

  if (!rawText || !rawText.includes('<think>')) {
    return {
      thinking: null,
      isThinkingComplete: true,
      content: rawText,
    }
  }

  const thinkStartIndex = rawText.indexOf('<think>')
  const thinkEndIndex = rawText.indexOf('</think>')

  if (thinkEndIndex !== -1) {
    const thinking = rawText.slice(thinkStartIndex + 7, thinkEndIndex).trim()
    const content = rawText.slice(thinkEndIndex + 8).trimStart()
    return {
      thinking,
      isThinkingComplete: true,
      content,
    }
  } else {
    const thinking = rawText.slice(thinkStartIndex + 7).trim()
    return {
      thinking,
      isThinkingComplete: false,
      content: '',
    }
  }
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  messages,
  isGenerating,
  isModelLoading = false,
  currentModelName,
  errorMessage,
  onRetry,
  onOpenRemoveBg,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating, isModelLoading])

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-8 min-h-full pb-44">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user'
        const isTool = msg.role === 'tool'
          const isAssistant = msg.role === 'assistant'
          const isLastAssistant = isAssistant && index === messages.length - 1 && isGenerating
          
          if (isTool) {
             // We can optionally hide or show tool messages. 
             // We will render them as a tiny log pill.
             return (
               <div key={msg.id} className="flex justify-center my-2">
                 <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40">
                   Alat dijalankan: {msg.tool_name}
                 </div>
               </div>
             )
          }


        // Check if user attached files in the prompt preceding this assistant message
        const prevUserMessage = index > 0 ? messages[index - 1] : null
        const hasAttachments = Boolean(
          prevUserMessage?.attachments && prevUserMessage.attachments.length > 0
        )

        const parsed = parseThinkingContent(msg.content, msg.thinking)
        if (msg.thinking !== undefined) {
          parsed.isThinkingComplete = msg.content.length > 0 || !isLastAssistant
        }
        
        const isWaitingForFirstResponse = isLastAssistant && !msg.content && !msg.thinking
        const durationStr = msg.thinkingDurationMs ? `${(msg.thinkingDurationMs / 1000).toFixed(1)}s` : undefined

        return (
          <div
            key={msg.id}
            className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              isUser ? 'items-end group/msg' : 'items-start group/assistant'
            }`}
          >
            {/* Role Header */}
            <div className="flex items-center gap-2 mb-2 text-xs text-white/50 select-none">
              {isUser ? (
                <>
                  <span>You</span>
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                    <User className="w-3 h-3" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img
                      src="/assets/logo.png"
                      alt={msg.model || currentModelName}
                      className="w-3.5 h-3.5 object-contain rounded-sm"
                    />
                  </div>
                  <span className="font-medium text-white/70">
                    {msg.model || currentModelName}
                  </span>
                </>
              )}
            </div>

            {/* Message Body */}
            {isUser ? (
              <div className="max-w-[85%] sm:max-w-[75%] flex flex-col items-end gap-2">
                {/* File Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {msg.attachments.map((att) =>
                      att.isImage && att.previewUrl ? (
                        <div
                          key={att.id}
                          className="group relative rounded-xl overflow-hidden border border-white/15 bg-black/40 shadow-md max-w-[260px]"
                        >
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            className="max-h-56 w-auto object-cover rounded-xl"
                          />

                          {onOpenRemoveBg && (
                            <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                              <button
                                type="button"
                                onClick={() => onOpenRemoveBg(att)}
                                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-1 px-2.5 py-1.5 rounded-full bg-black/75 hover:bg-orange-600 active:bg-orange-700 text-white text-[11px] font-medium border border-white/20 shadow-lg backdrop-blur-md transition-all cursor-pointer"
                                title="Hapus background gambar ini dengan rembg AI"
                                aria-label={`Hapus background ${att.name}`}
                              >
                                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                                <span className="hidden sm:inline">Hapus BG</span>
                              </button>
                            </div>
                          )}

                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-4">
                            <p className="text-[11px] text-white/95 truncate font-medium">{att.name}</p>
                            <p className="text-[10px] text-white/60">{formatFileSize(att.size)}</p>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={att.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#201511]/90 border border-white/15 text-xs text-white shadow-md backdrop-blur-sm"
                        >
                          <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                            {isCodeFile(att.name) ? (
                              <Code2 className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 max-w-[180px]">
                            <span className="truncate font-medium text-white/95 text-xs">{att.name}</span>
                            <span className="text-[10px] text-white/50">{formatFileSize(att.size)}</span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* User Message Bubble */}
                {msg.content && (
                  <UserMessageBubble content={msg.content} />
                )}
              </div>
            ) : (
              /* AI Response Area */
              <div className="w-full text-white/90 text-sm sm:text-[15px] leading-relaxed prose prose-invert max-w-none">
                {/* 1. Active Thinking Animation (when waiting for first tokens from model) */}
                {isWaitingForFirstResponse && (
                  <div className="py-1">
                    <ThinkingIndicator
                      modelName={msg.model || currentModelName}
                      hasAttachments={hasAttachments}
                      isModelLoading={isModelLoading}
                      isThinkingEnabled={msg.thinking !== undefined}
                    />
                  </div>
                )}

                {/* 2. Reasoning Process Block (if model produces <think> tags) */}
                {parsed.thinking && (
                  <ReasoningBlock
                    thinking={parsed.thinking}
                    isComplete={parsed.isThinkingComplete}
                    durationStr={durationStr}
                  />
                )}

                {/* 3. Main Response Content */}
                {parsed.content && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && !String(children).includes('\n')
                        return isInline ? (
                          <code
                            className="px-1.5 py-0.5 rounded bg-white/10 text-orange-200 font-mono text-xs"
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <CodeBlock language={match ? match[1] : ''}>
                            {String(children).replace(/\n$/, '')}
                          </CodeBlock>
                        )
                      },
                      p({ children }) {
                        return <p className="mb-4 leading-relaxed text-white/90">{children}</p>
                      },
                      ul({ children }) {
                        return <ul className="list-disc pl-6 mb-4 space-y-1 text-white/80">{children}</ul>
                      },
                      ol({ children }) {
                        return <ol className="list-decimal pl-6 mb-4 space-y-1 text-white/80">{children}</ol>
                      },
                      li({ children }) {
                        return <li className="leading-relaxed">{children}</li>
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-2 border-orange-500/60 pl-4 py-1 my-3 text-white/70 italic bg-white/[0.02] rounded-r">
                            {children}
                          </blockquote>
                        )
                      },
                      table({ children }) {
                        return (
                          <div className="overflow-x-auto my-4 rounded-xl border border-white/10">
                            <table className="min-w-full divide-y divide-white/10 text-xs text-left">
                              {children}
                            </table>
                          </div>
                        )
                      },
                      th({ children }) {
                        return (
                          <th className="px-3 py-2 bg-white/5 font-semibold text-white/80">
                            {children}
                          </th>
                        )
                      },
                      td({ children }) {
                        return (
                          <td className="px-3 py-2 border-t border-white/5 text-white/70">
                            {children}
                          </td>
                        )
                      },
                    }}
                  >
                    {parsed.content}
                  </ReactMarkdown>
                )}

                
                {/* 4. Tool Calls */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (() => {
                  const writeCalls = msg.tool_calls.filter((tc: any) =>
                    ['edit_file', 'write_file', 'create_file', 'delete_file'].includes(tc.function.name)
                  );
                  const approvedCount = msg.tool_status?.startsWith('approved') ? writeCalls.length : 0;
                  const rejectedCount = msg.tool_status === 'rejected' ? writeCalls.length : 0;
                  const failedCount = msg.tool_status?.startsWith('failed') ? writeCalls.length : 0;
                  const pendingCount = msg.tool_status === 'pending' ? writeCalls.length : 0;

                  return (
                    <div className="mt-4 space-y-2.5">
                      {msg.tool_calls.map((tc: any, tcIdx: number) => {
                        const fnName = tc.function.name;
                        const args = tc.function.arguments || {};
                        const isWrite = ['edit_file', 'write_file', 'create_file', 'delete_file'].includes(fnName);
                        
                        let title = fnName;
                        const detail = '';
                        let ToolIcon = Code2;
                        let iconColor = 'text-orange-400';

                        if (fnName === 'list_dir') {
                          title = `Melihat direktori: ${args.path || '/'}`;
                          ToolIcon = Code2;
                        } else if (fnName === 'read_file') {
                          title = `Membaca file: ${args.path}`;
                          if (args.startLine) {
                            title += ` (baris ${args.startLine}-${args.endLine || 'akhir'})`;
                          }
                          ToolIcon = Code2;
                        } else if (fnName === 'search') {
                          title = `Mencari teks: "${args.query}"`;
                          ToolIcon = Code2;
                        } else if (fnName === 'edit_file') {
                          title = `Usulan edit file: ${args.path}`;
                          ToolIcon = FileEdit;
                          iconColor = 'text-amber-400';
                        } else if (fnName === 'write_file') {
                          title = `Usulan tulis file: ${args.path}`;
                          ToolIcon = FileText;
                          iconColor = 'text-blue-400';
                        } else if (fnName === 'create_file') {
                          title = `Usulan buat file baru: ${args.path}`;
                          ToolIcon = FilePlus;
                          iconColor = 'text-emerald-400';
                        } else if (fnName === 'delete_file') {
                          title = `Usulan hapus file: ${args.path}`;
                          ToolIcon = Trash2;
                          iconColor = 'text-rose-400';
                        }

                        return (
                          <div key={tcIdx} className="p-3.5 rounded-xl border border-white/10 bg-white/5 text-xs shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-white/90 font-medium">
                                <ToolIcon className={`w-4 h-4 ${iconColor}`} />
                                <span className="font-mono">{title}</span>
                              </div>
                              {isWrite && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 uppercase tracking-wider font-semibold">
                                  {fnName.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            {/* Detail untuk read-only non-empty args */}
                            {detail && (
                              <div className="mt-2 text-white/60 bg-black/40 p-2.5 rounded max-h-32 overflow-auto font-mono text-[10px] whitespace-pre border border-white/5">
                                {detail}
                              </div>
                            )}
                            
                            {/* Visual Diff Card untuk Usulan Tulis */}
                            {isWrite && msg.tool_status === 'pending' && (
                              <div className="mt-3 space-y-2.5">
                                {fnName === 'edit_file' && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono border border-white/10 rounded-lg overflow-hidden">
                                    <div className="bg-rose-950/30 text-rose-200 p-2.5 overflow-auto max-h-40 border-b md:border-b-0 md:border-r border-rose-500/20">
                                      <div className="text-rose-400/70 font-semibold mb-1 select-none flex items-center gap-1">
                                        <span>- Sebelum:</span>
                                      </div>
                                      <pre className="whitespace-pre-wrap">{args.old_str}</pre>
                                    </div>
                                    <div className="bg-emerald-950/30 text-emerald-200 p-2.5 overflow-auto max-h-40">
                                      <div className="text-emerald-400/70 font-semibold mb-1 select-none flex items-center gap-1">
                                        <span>+ Sesudah:</span>
                                      </div>
                                      <pre className="whitespace-pre-wrap">{args.new_str}</pre>
                                    </div>
                                  </div>
                                )}

                                {fnName === 'write_file' && (
                                  <div className="text-[10px] font-mono border border-white/10 rounded-lg overflow-hidden bg-black/40">
                                    <div className="bg-blue-950/40 text-blue-200 px-3 py-1.5 border-b border-blue-500/20 font-semibold select-none">
                                      + Seluruh Isi Baru yang Dituliskan ({args.content?.split('\n').length || 1} baris):
                                    </div>
                                    <pre className="p-2.5 text-blue-100 overflow-auto max-h-48 whitespace-pre-wrap">
                                      {args.content}
                                    </pre>
                                  </div>
                                )}

                                {fnName === 'create_file' && (
                                  <div className="text-[10px] font-mono border border-white/10 rounded-lg overflow-hidden bg-black/40">
                                    <div className="bg-emerald-950/40 text-emerald-200 px-3 py-1.5 border-b border-emerald-500/20 font-semibold select-none">
                                      + Pratinjau Berkas Baru ({args.content?.split('\n').length || 1} baris):
                                    </div>
                                    <pre className="p-2.5 text-emerald-100 overflow-auto max-h-48 whitespace-pre-wrap">
                                      {args.content}
                                    </pre>
                                  </div>
                                )}

                                {fnName === 'delete_file' && (
                                  <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                                    <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span>Peringatan: Berkas ini akan dihapus permanen dari folder kerja.</span>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-1">
                                  <button 
                                    onClick={() => {
                                      const evt = new CustomEvent('tool-approval', { detail: { msgId: msg.id, tc, action: 'approve' }});
                                      window.dispatchEvent(evt);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors cursor-pointer text-xs shadow-sm flex items-center gap-1.5"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Terapkan
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const evt = new CustomEvent('tool-approval', { detail: { msgId: msg.id, tc, action: 'reject' }});
                                      window.dispatchEvent(evt);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 font-medium transition-colors cursor-pointer text-xs"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Applying Loading State */}
                            {isWrite && msg.tool_status === 'applying' && (
                              <div className="mt-2.5 text-[11px] font-medium text-orange-400 flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></span>
                                <span>Menerapkan perubahan ke berkas lokal...</span>
                              </div>
                            )}

                            {/* Applied / Failed / Rejected States */}
                            {isWrite && msg.tool_status !== 'pending' && msg.tool_status !== 'applying' && msg.tool_status && (
                              <div className="mt-2.5 space-y-2">
                                {msg.tool_status.startsWith('approved') && (
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                                      <Check className="w-3.5 h-3.5" />
                                      Status: Diterapkan
                                    </span>
                                    {msg.tool_status.startsWith('approved:') && (
                                      <button
                                        onClick={() => {
                                          const undoId = parseInt(msg.tool_status!.split(':')[1]);
                                          const evt = new CustomEvent('tool-undo', { detail: { msgId: msg.id, tc, undoId }});
                                          window.dispatchEvent(evt);
                                        }}
                                        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white/90 cursor-pointer text-[10px] transition-colors"
                                      >
                                        <Undo2 className="w-3 h-3" />
                                        Urungkan
                                      </button>
                                    )}
                                  </div>
                                )}

                                {msg.tool_status === 'undone' && (
                                  <div className="text-[11px] text-amber-300 font-medium flex items-center gap-1.5">
                                    <Undo2 className="w-3.5 h-3.5" />
                                    <span>Status: Telah diurungkan oleh pengguna</span>
                                  </div>
                                )}

                                {msg.tool_status === 'rejected' && (
                                  <div className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
                                    <span>Status: Ditolak oleh pengguna</span>
                                  </div>
                                )}

                                {msg.tool_status.startsWith('failed') && (
                                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-[11px] space-y-1.5">
                                    <div className="flex items-start gap-1.5 font-medium text-rose-300">
                                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                                      <span>
                                        Gagal Diterapkan: {msg.tool_error || (msg.tool_status.includes(':') ? msg.tool_status.split(':')[1] : 'Terjadi kendala pada berkas')}
                                      </span>
                                    </div>
                                    {(msg.tool_status.includes('permission') || msg.tool_error?.toLowerCase().includes('izin')) && (
                                      <div className="pt-1">
                                        <button
                                          onClick={() => {
                                            const evt = new CustomEvent('request-write-permission');
                                            window.dispatchEvent(evt);
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs cursor-pointer shadow-sm transition-colors"
                                        >
                                          <ShieldAlert className="w-3.5 h-3.5" />
                                          Berikan Izin Tulis
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Ringkasan Status Tindakan Nyata */}
                      {writeCalls.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-white/70">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white/90">Ringkasan Operasi:</span>
                            <span className={approvedCount === writeCalls.length && approvedCount > 0 ? 'text-emerald-400 font-medium' : ''}>
                              {approvedCount} dari {writeCalls.length} perubahan diterapkan
                              {failedCount > 0 ? ` (${failedCount} gagal)` : ''}
                              {rejectedCount > 0 ? ` (${rejectedCount} ditolak)` : ''}
                            </span>
                          </div>
                          {pendingCount > 0 && (
                            <span className="text-amber-400 font-medium">{pendingCount} menunggu konfirmasi</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Blinking Cursor during live streaming */}
                {isLastAssistant && parsed.content && (
                  <span className="inline-block w-2 h-4 ml-1 bg-orange-400 animate-pulse rounded-xs align-middle" />
                )}

                {/* Assistant Message Actions (Copy response) */}
                {!isLastAssistant && parsed.content && (
                  <div className="not-prose mt-2.5 pt-1">
                    <AssistantMessageActions content={parsed.content} />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Error or Offline Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/30 flex items-start justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">{errorMessage}</p>
              <p className="text-amber-300/70 mt-0.5">
                Pastikan Ollama aktif di port 11434 (`ollama serve`). Anda tetap dapat berinteraksi dalam mode simulasi offline.
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-white font-medium transition-colors shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              Coba Ulang
            </button>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      textArea.remove()
      return successful
    }
  } catch (err) {
    console.error('Gagal menyalin teks:', err)
    return false
  }
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(children)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-white/10 bg-[#161618] text-xs font-mono">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#202024] text-white/60 border-b border-white/5">
        <span className="text-[11px] font-medium tracking-wide uppercase text-white/40">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] hover:text-white transition-colors p-1 cursor-pointer select-none"
          title="Salin kode"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>

      <pre className="p-4 overflow-x-auto text-white/90 leading-normal">
        <code>{children}</code>
      </pre>
    </div>
  )
}

function UserMessageBubble({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Approximately 12 lines threshold (assuming roughly ~60 chars per line, or actual newlines)
  const lineCount = (content.match(/\n/g) || []).length + 1
  const isLong = lineCount > 12 || content.length > 800

  const handleCopy = async () => {
    const success = await copyToClipboard(content.trim())
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5 max-w-full">
      {/* Bubble */}
      <div className="px-4 py-2.5 rounded-2xl bg-[var(--color-surface)] text-white text-sm sm:text-[15px] leading-relaxed shadow-sm border border-white/5 break-words">
        <div className={`whitespace-pre-wrap ${!expanded && isLong ? 'line-clamp-[12] max-h-[17rem] overflow-hidden' : ''}`}>
          {content}
        </div>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[11px] font-medium text-orange-400/80 hover:text-orange-400 transition-colors uppercase tracking-wide cursor-pointer"
          >
            {expanded ? 'Sembunyikan' : 'Tampilkan semua'}
          </button>
        )}
      </div>

      {/* Action button: Salin pertanyaan */}
      <div
        className={`flex items-center gap-1.5 pr-1 transition-opacity duration-200 ${
          copied
            ? 'opacity-100'
            : 'opacity-70 sm:opacity-0 group-hover/msg:opacity-100 group-focus-within/msg:opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 active:scale-95 transition-all text-xs cursor-pointer select-none"
          title={copied ? 'Pertanyaan tersalin ke clipboard' : 'Salin pertanyaan'}
          aria-label={copied ? 'Pertanyaan tersalin' : 'Salin pertanyaan'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Salin</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function AssistantMessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(content.trim())
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className={`flex items-center gap-2 transition-opacity duration-200 ${
        copied
          ? 'opacity-100'
          : 'opacity-70 sm:opacity-0 group-hover/assistant:opacity-100 group-focus-within/assistant:opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 active:scale-95 transition-all text-xs cursor-pointer select-none"
        title={copied ? 'Jawaban tersalin ke clipboard' : 'Salin jawaban'}
        aria-label={copied ? 'Jawaban tersalin' : 'Salin jawaban'}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-medium">Tersalin</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span className="text-[11px]">Salin</span>
          </>
        )}
      </button>
    </div>
  )
}

