import {
  IPC_CHANNELS,
  ipcRequestSchemas,
  ipcResponseSchemas,
  isWhitelistedChannel,
  type IpcChannel,
} from '@focus-go/db-contracts'
import type { AuditLogger } from '../audit/logger'

type HandlerResult = unknown
export type IpcHandler = (payload: unknown) => Promise<HandlerResult> | HandlerResult
export type IpcHandlerMap = Partial<Record<IpcChannel, IpcHandler>>

type IpcSuccessResponse = { ok: true; data: unknown }
type IpcErrorResponse = { ok: false; error: { code: string; message: string } }
export type IpcResponse = IpcSuccessResponse | IpcErrorResponse

const errorResponse = (code: string, message: string): IpcErrorResponse => ({
  ok: false,
  error: { code, message },
})

const safeAuditLog = (logger: AuditLogger, entry: { channel: string; ok: boolean; errorCode?: string }) => {
  void logger.log({
    timestamp: new Date().toISOString(),
    channel: entry.channel,
    ok: entry.ok,
    errorCode: entry.errorCode,
  })
}

export const createIpcRouter = (handlers: IpcHandlerMap, logger: AuditLogger) => ({
  async handle(channel: string, payload: unknown): Promise<IpcResponse> {
    if (!isWhitelistedChannel(channel)) {
      const response = errorResponse('CHANNEL_NOT_ALLOWED', `Channel not allowed: ${channel}`)
      safeAuditLog(logger, { channel, ok: false, errorCode: response.error.code })
      return response
    }

    const parsedPayload = ipcRequestSchemas[channel].safeParse(payload ?? {})
    if (!parsedPayload.success) {
      const response = errorResponse('INVALID_PAYLOAD', `Invalid payload for channel: ${channel}`)
      safeAuditLog(logger, { channel, ok: false, errorCode: response.error.code })
      return response
    }

    const handler = handlers[channel]
    if (!handler) {
      const response = errorResponse('NOT_IMPLEMENTED', `No handler registered for channel: ${channel}`)
      safeAuditLog(logger, { channel, ok: false, errorCode: response.error.code })
      return response
    }

    try {
      const result = await handler(parsedPayload.data)
      const response: IpcSuccessResponse = { ok: true, data: result ?? null }
      const parsedResponse = ipcResponseSchemas[channel].safeParse(response)
      if (!parsedResponse.success) {
        const invalid = errorResponse('INVALID_RESPONSE', `Invalid response schema for channel: ${channel}`)
        safeAuditLog(logger, { channel, ok: false, errorCode: invalid.error.code })
        return invalid
      }
      safeAuditLog(logger, { channel, ok: true })
      return parsedResponse.data
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const response = errorResponse('HANDLER_FAILED', message)
      safeAuditLog(logger, { channel, ok: false, errorCode: response.error.code })
      return response
    }
  },
})

export const registerIpcHandlers = (
  ipcMainLike: { handle: (channel: string, handler: (_event: unknown, payload: unknown) => unknown) => void },
  router: ReturnType<typeof createIpcRouter>
) => {
  for (const channel of IPC_CHANNELS) {
    ipcMainLike.handle(channel, (_event, payload) => router.handle(channel, payload))
  }
}
