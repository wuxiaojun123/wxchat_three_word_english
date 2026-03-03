import { WORD_BANK, Word } from '../data/words'

export interface HistoryEntry {
  dateKey: string
  completedAt: number
}

export interface DailyProgress {
  viewedWordIds: number[]
  completed: boolean
  completedAt?: number
}

const PROGRESS_PREFIX = 'daily_word_progress:'
const HISTORY_KEY = 'daily_word_history'

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysSinceEpoch(dateKey: string): number {
  const midnight = new Date(`${dateKey}T00:00:00`)
  return Math.floor(midnight.getTime() / 86400000)
}

export function getWordsByDate(dateKey: string): Word[] {
  const total = WORD_BANK.length
  const start = (daysSinceEpoch(dateKey) * 3) % total
  const result: Word[] = []
  for (let i = 0; i < 3; i += 1) {
    result.push(WORD_BANK[(start + i) % total])
  }
  return result
}

function progressKey(dateKey: string): string {
  return `${PROGRESS_PREFIX}${dateKey}`
}

export function getProgress(dateKey: string): DailyProgress {
  return (
    wx.getStorageSync(progressKey(dateKey)) || {
      viewedWordIds: [],
      completed: false,
    }
  )
}

function setProgress(dateKey: string, progress: DailyProgress): void {
  wx.setStorageSync(progressKey(dateKey), progress)
}

export function markWordViewed(dateKey: string, wordId: number): DailyProgress {
  const progress = getProgress(dateKey)

  if (!progress.viewedWordIds.includes(wordId)) {
    progress.viewedWordIds = [...progress.viewedWordIds, wordId]
  }

  if (progress.viewedWordIds.length >= 3) {
    progress.completed = true
    progress.completedAt = Date.now()
    upsertHistory(dateKey, progress.completedAt)
  }

  setProgress(dateKey, progress)
  return progress
}

export function isWordViewed(wordId: number, progress: DailyProgress): boolean {
  return progress.viewedWordIds.includes(wordId)
}

export function upsertHistory(dateKey: string, completedAt: number): void {
  const history = getHistory()
  const existingIndex = history.findIndex((entry) => entry.dateKey === dateKey)
  const newEntry: HistoryEntry = {
    dateKey,
    completedAt,
  }

  if (existingIndex >= 0) {
    history[existingIndex] = newEntry
  } else {
    history.push(newEntry)
  }

  history.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  wx.setStorageSync(HISTORY_KEY, history)
}

export function getHistory(): HistoryEntry[] {
  return wx.getStorageSync(HISTORY_KEY) || []
}

export function getCurrentStreak(history: HistoryEntry[]): number {
  if (history.length === 0) {
    return 0
  }

  const dateSet = new Set(history.map((entry) => entry.dateKey))
  const today = new Date()
  let streak = 0
  while (true) {
    const current = new Date(today)
    current.setDate(today.getDate() - streak)
    const key = toDateKey(current)
    if (!dateSet.has(key)) {
      break
    }
    streak += 1
  }
  return streak
}
