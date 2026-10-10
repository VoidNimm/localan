export function logDiagnostic(tag: string, data: any) {
  if (import.meta.env?.DEV) {
    console.debug(`[${tag}]`, data)
  }
}
