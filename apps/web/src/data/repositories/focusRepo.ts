import type { FocusSettings, FocusTimerSnapshot, NoiseSettings } from '../models/types'
import { dbService } from '../services/dbService'

type FocusSettingsWithTimer = FocusSettings & {
  timer?: FocusTimerSnapshot
}

type FocusUpsertInput = Parameters<typeof dbService.focus.upsert>[0]

export const focusRepo = {
  async get() {
    return dbService.focus.get() as Promise<FocusSettingsWithTimer | null>
  },
  async upsert(data: Omit<FocusSettingsWithTimer, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.focus.upsert(data as unknown as FocusUpsertInput) as Promise<FocusSettingsWithTimer>
  },
  async getTimer() {
    const settings = (await dbService.focus.get()) as FocusSettingsWithTimer | null
    return settings?.timer ?? null
  },
  async updateTimer(timer: FocusTimerSnapshot) {
    const existing = (await dbService.focus.get()) as FocusSettingsWithTimer | null
    const nextFocusMinutes = existing?.focusMinutes ?? timer.durationMinutes ?? 25
    const nextBreakMinutes = existing?.breakMinutes ?? 5
    const nextLongBreakMinutes = existing?.longBreakMinutes ?? 15
    const payload = {
      focusMinutes: nextFocusMinutes,
      breakMinutes: nextBreakMinutes,
      longBreakMinutes: nextLongBreakMinutes,
      noise: existing?.noise,
      noisePreset: existing?.noisePreset,
      volume: existing?.volume,
      timer,
    }
    return dbService.focus.upsert(payload as unknown as FocusUpsertInput) as Promise<FocusSettingsWithTimer>
  },
  async updateNoise(noise: NoiseSettings) {
    const existing = (await dbService.focus.get()) as FocusSettingsWithTimer | null
    const payload = {
      focusMinutes: existing?.focusMinutes ?? 25,
      breakMinutes: existing?.breakMinutes ?? 5,
      longBreakMinutes: existing?.longBreakMinutes ?? 15,
      noise,
      noisePreset: existing?.noisePreset,
      volume: existing?.volume,
      timer: existing?.timer,
    }
    return dbService.focus.upsert(payload as unknown as FocusUpsertInput) as Promise<FocusSettingsWithTimer>
  },
  async listSessions(limit?: number) {
    return dbService.focusSessions.list(limit)
  },
  async startSession(data: { taskId?: string; goal?: string; plannedMinutes: number }) {
    return dbService.focusSessions.start(data)
  },
  async completeSession(id: string, data?: { actualMinutes?: number; completedAt?: number }) {
    return dbService.focusSessions.complete(id, data)
  },
}
