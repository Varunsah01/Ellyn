"use client"

const POST_MESSAGE_TIMEOUT_MS = 3000
const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID?.trim() ||
  process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID?.trim() ||
  ""

const EXTENSION_STORAGE_KEY = "ellyn_extension_id"

const BRIDGE_REQUEST_TYPE = "ELLYN_EXTENSION_BRIDGE_REQUEST"
const BRIDGE_RESPONSE_TYPE = "ELLYN_EXTENSION_BRIDGE_RESPONSE"

type RuntimeErrorLike = { message?: string }

type ChromeRuntimeLike = {
  id?: string
  sendMessage?: (...args: unknown[]) => void
  lastError?: RuntimeErrorLike
}

type ChromeLike = {
  runtime?: ChromeRuntimeLike
}

type BridgeResponsePayload = {
  success?: boolean
  ok?: boolean
  error?: string
  [key: string]: unknown
}

export type ExtensionBridgeResponse = {
  success: boolean
  error?: string
  [key: string]: unknown
}

export type SavedTemplate = {
  id: string
  name: string
  subject: string
  body: string
  tone?: string | null
  category?: string | null
  use_case?: string | null
  variables?: string[] | null
  savedAt?: string | null
}

let cachedInstallStatus: boolean | null = null
let installProbeInFlight: Promise<void> | null = null

function getChromeRuntime(): ChromeRuntimeLike | null {
  if (typeof window === "undefined") return null

  const chrome = (window as Window & { chrome?: ChromeLike }).chrome
  return chrome?.runtime ?? null
}

function readStoredExtensionId(): string {
  if (typeof window === "undefined") return ""

  try {
    return localStorage.getItem(EXTENSION_STORAGE_KEY)?.trim() || ""
  } catch {
    return ""
  }
}

function resolveExtensionId(): string {
  return EXTENSION_ID || readStoredExtensionId()
}

function normalizeBridgeResponse(payload: unknown): ExtensionBridgeResponse {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Invalid extension response" }
  }

  const raw = payload as BridgeResponsePayload
  const success = raw.success === true || raw.ok === true
  const error =
    typeof raw.error === "string" && raw.error.trim() ? raw.error.trim() : undefined

  return {
    ...raw,
    success,
    ...(error ? { error } : {}),
  }
}

function normalizeTemplate(template: SavedTemplate): SavedTemplate | null {
  const id = String(template.id || "").trim()
  const name = String(template.name || "").trim()
  const subject = String(template.subject || "").trim()
  const body = String(template.body || "").trim()

  if (!id || !name || !subject || !body) {
    return null
  }

  return {
    id,
    name,
    subject,
    body,
    tone: String(template.tone || "professional").trim() || "professional",
    category: String(template.category || "general").trim() || "general",
    use_case: String(template.use_case || "general").trim() || "general",
    variables: Array.isArray(template.variables)
      ? template.variables
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [],
    savedAt:
      String(template.savedAt || "").trim() || new Date().toISOString(),
  }
}

function sendViaChromeRuntime(
  extensionId: string,
  payload: Record<string, unknown>
): Promise<ExtensionBridgeResponse> {
  return new Promise((resolve) => {
    const runtime = getChromeRuntime()
    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve({ success: false, error: "Extension not installed" })
      return
    }

    const callback = (response: unknown) => {
      const runtimeError =
        typeof runtime.lastError?.message === "string"
          ? runtime.lastError.message
          : ""

      if (runtimeError) {
        resolve({ success: false, error: runtimeError })
        return
      }

      resolve(normalizeBridgeResponse(response))
    }

    try {
      if (extensionId) {
        ;(runtime.sendMessage as (
          extension: string,
          message: unknown,
          callback: (response: unknown) => void
        ) => void)(extensionId, payload, callback)
        return
      }

      if (runtime.id) {
        ;(runtime.sendMessage as (
          message: unknown,
          callback: (response: unknown) => void
        ) => void)(payload, callback)
        return
      }

      resolve({ success: false, error: "Extension not installed" })
    } catch (error) {
      resolve({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to contact extension",
      })
    }
  })
}

function sendViaWindowPostMessage(
  type: string,
  data?: object
): Promise<ExtensionBridgeResponse> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ success: false, error: "Extension not installed" })
      return
    }

    const requestId = `ellyn_req_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`
    let done = false
    let timeoutRef: ReturnType<typeof setTimeout> | null = null

    const finish = (result: ExtensionBridgeResponse) => {
      if (done) return
      done = true

      window.removeEventListener("message", onMessage)
      if (timeoutRef) {
        clearTimeout(timeoutRef)
        timeoutRef = null
      }

      resolve(result)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      if (!event.data || typeof event.data !== "object") return

      const payload = event.data as {
        type?: string
        requestId?: string
        success?: boolean
        ok?: boolean
        error?: string
        [key: string]: unknown
      }

      const acceptedResultType =
        payload.type === BRIDGE_RESPONSE_TYPE ||
        payload.type === `${type}_RESULT` ||
        payload.type === "ELLYN_SAVE_TEMPLATE_RESULT"

      if (!acceptedResultType) return
      if (payload.requestId && payload.requestId !== requestId) return

      finish(normalizeBridgeResponse(payload))
    }

    window.addEventListener("message", onMessage)
    timeoutRef = setTimeout(() => {
      finish({ success: false, error: "Extension not installed" })
    }, POST_MESSAGE_TIMEOUT_MS)

    const messagePayload = {
      type,
      ...(data ?? {}),
      requestId,
    }

    window.postMessage(
      {
        type: BRIDGE_REQUEST_TYPE,
        requestId,
        payload: messagePayload,
      },
      "*"
    )

    window.postMessage(messagePayload, "*")
  })
}

function shouldTryPostMessageFallback(result: ExtensionBridgeResponse): boolean {
  if (result.success) return false

  const errorText = String(result.error || "").toLowerCase()
  if (!errorText) return true

  return (
    errorText.includes("not installed") ||
    errorText.includes("receiving end does not exist") ||
    errorText.includes("could not establish connection") ||
    errorText.includes("message port closed")
  )
}

function updateInstallCache(result: ExtensionBridgeResponse) {
  cachedInstallStatus = result.success
}

export async function extensionSendMessage(
  type: string,
  data?: object
): Promise<ExtensionBridgeResponse> {
  if (typeof window === "undefined") {
    return { success: false, error: "Extension not installed" }
  }

  const payload = {
    type,
    ...(data ?? {}),
  }

  const runtimeResult = await sendViaChromeRuntime(resolveExtensionId(), payload)
  if (runtimeResult.success) {
    updateInstallCache(runtimeResult)
    return runtimeResult
  }

  if (!shouldTryPostMessageFallback(runtimeResult)) {
    updateInstallCache(runtimeResult)
    return runtimeResult
  }

  const postMessageResult = await sendViaWindowPostMessage(type, data)
  updateInstallCache(postMessageResult)

  if (postMessageResult.success) return postMessageResult

  return {
    success: false,
    error: "Extension not installed",
  }
}

export async function extensionSaveTemplate(
  template: SavedTemplate
): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeTemplate(template)
  if (!normalized) {
    return { success: false, error: "Invalid template payload" }
  }

  const response = await extensionSendMessage("ELLYN_SAVE_TEMPLATE", {
    template: normalized,
  })

  if (response.success && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ellyn-extension-templates-updated")
    )
  }

  return {
    success: response.success,
    ...(response.error ? { error: response.error } : {}),
  }
}

export async function extensionGetTemplates(): Promise<SavedTemplate[]> {
  const response = await extensionSendMessage("ELLYN_GET_TEMPLATES")
  if (!response.success) return []

  const templates = Array.isArray(response.templates) ? response.templates : []
  return templates
    .map((item) => normalizeTemplate(item as SavedTemplate))
    .filter((item): item is SavedTemplate => Boolean(item))
}

export async function extensionDeleteTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const templateId = String(id || "").trim()
  if (!templateId) {
    return { success: false, error: "Template id is required" }
  }

  const response = await extensionSendMessage("ELLYN_DELETE_TEMPLATE", {
    id: templateId,
  })

  if (response.success && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ellyn-extension-templates-updated")
    )
  }

  return {
    success: response.success,
    ...(response.error ? { error: response.error } : {}),
  }
}

export function isExtensionInstalled(): boolean {
  if (typeof window === "undefined") return false

  const runtime = getChromeRuntime()
  if (runtime?.id) return true

  if (cachedInstallStatus !== null) {
    return cachedInstallStatus
  }

  const canPing =
    Boolean(resolveExtensionId()) && typeof runtime?.sendMessage === "function"

  if (canPing && !installProbeInFlight) {
    installProbeInFlight = extensionSendMessage("ELLYN_GET_TEMPLATES")
      .then((result) => {
        cachedInstallStatus = result.success
      })
      .catch(() => {
        cachedInstallStatus = false
      })
      .finally(() => {
        installProbeInFlight = null
      })
  }

  return false
}
