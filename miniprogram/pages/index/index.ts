import { Word } from '../../data/words'
import {
  getCurrentStreak,
  getHistory,
  getProgress,
  getWordsByDate,
  isWordViewed,
  markWordViewed,
  toDateKey,
} from '../../utils/learning'

interface WordCard extends Word {
  revealed: boolean
  exampleVisible: boolean
  viewed: boolean
}

function toDisplayDate(dateKey: string): string {
  return dateKey.replace(/-/g, '.')
}

function getRouteDateKey(): string {
  const pages = getCurrentPages() as Array<{ options?: Record<string, string> }>
  const current = pages[pages.length - 1]
  const value = current && current.options ? current.options.dateKey : ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  return ''
}

function isToday(dateKey: string): boolean {
  return dateKey === toDateKey(new Date())
}

let audioCtx: WechatMiniprogram.InnerAudioContext | null = null
let playbackQueue: string[] = []
let queueCursor = 0
let playbackMode: 'none' | 'sentence' | 'wordQueue' = 'none'
let sentenceUrls: string[] = []
let sentenceCursor = 0
let sentenceWatchdog: number | null = null
let queueGapTimer: number | null = null
let exitCountdownTimer: number | null = null

const WORD_GAP_MS = 70

function clearSentenceWatchdog(): void {
  if (sentenceWatchdog !== null) {
    clearTimeout(sentenceWatchdog)
    sentenceWatchdog = null
  }
}

function clearQueueGapTimer(): void {
  if (queueGapTimer !== null) {
    clearTimeout(queueGapTimer)
    queueGapTimer = null
  }
}

function clearExitCountdownTimer(): void {
  if (exitCountdownTimer !== null) {
    clearInterval(exitCountdownTimer)
    exitCountdownTimer = null
  }
}

function resetQueue(): void {
  playbackQueue = []
  queueCursor = 0
}

function resetSentence(): void {
  sentenceUrls = []
  sentenceCursor = 0
}

function resetPlayback(): void {
  clearSentenceWatchdog()
  clearQueueGapTimer()
  resetQueue()
  resetSentence()
  playbackMode = 'none'
}

function playQueueNext(): void {
  if (!audioCtx) {
    resetPlayback()
    return
  }
  if (queueCursor >= playbackQueue.length) {
    resetPlayback()
    return
  }
  const token = playbackQueue[queueCursor]
  queueCursor += 1
  audioCtx.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(token)}&type=2`
  audioCtx.play()
}

function playSentenceNext(): void {
  if (!audioCtx) {
    resetPlayback()
    return
  }
  if (sentenceCursor >= sentenceUrls.length) {
    resetPlayback()
    return
  }
  const url = sentenceUrls[sentenceCursor]
  sentenceCursor += 1
  clearSentenceWatchdog()
  sentenceWatchdog = setTimeout(() => {
    if (!audioCtx || playbackMode !== 'sentence') {
      return
    }
    if (playbackQueue.length > 0) {
      playbackMode = 'wordQueue'
      queueCursor = 0
      playQueueNext()
    }
  }, 1200) as unknown as number
  audioCtx.src = url
  audioCtx.play()
}

function buildSentenceUrls(sentence: string): string[] {
  const content = sentence.trim()
  if (!content) {
    return []
  }
  const encoded = encodeURIComponent(content)
  return [
    `https://dict.youdao.com/speech?audio=${encoded}`,
    `https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`,
    `https://dict.youdao.com/dictvoice?audio=${encoded}&le=en`,
  ]
}

Component({
  data: {
    dateKey: '',
    dateLabel: '',
    summaryTitle: '今天的 3 个单词',
    isHistoryMode: false,
    navBack: false,
    cards: [] as WordCard[],
    currentIndex: 0,
    viewedCount: 0,
    completed: false,
    streak: 0,
    completionActionVisible: false,
    exitCountdownVisible: false,
    exitCountdown: 3,
    exitFallbackVisible: false,
  },
  lifetimes: {
    attached() {
      audioCtx = wx.createInnerAudioContext()
      audioCtx.onEnded(() => {
        clearSentenceWatchdog()
        if (playbackMode === 'wordQueue') {
          clearQueueGapTimer()
          queueGapTimer = setTimeout(() => {
            playQueueNext()
          }, WORD_GAP_MS) as unknown as number
          return
        }
        if (playbackMode === 'sentence') {
          resetPlayback()
        }
      })
      audioCtx.onError(() => {
        clearSentenceWatchdog()
        if (playbackMode === 'sentence' && sentenceCursor < sentenceUrls.length) {
          playSentenceNext()
          return
        }
        if (playbackMode === 'sentence' && playbackQueue.length > 0) {
          playbackMode = 'wordQueue'
          queueCursor = 0
          playQueueNext()
          return
        }
        if (playbackMode === 'wordQueue' && playbackQueue.length > 0) {
          playQueueNext()
          return
        }
        wx.showToast({ title: '音频播放失败', icon: 'none' })
        resetPlayback()
      })
      audioCtx.onPlay(() => {
        clearSentenceWatchdog()
      })
      this.loadByRoute()
    },
    detached() {
      clearExitCountdownTimer()
      if (audioCtx) {
        audioCtx.destroy()
        audioCtx = null
      }
    },
  },
  pageLifetimes: {
    show() {
      this.loadByRoute()
    },
  },
  methods: {
    loadByRoute() {
      clearExitCountdownTimer()
      const routeDateKey = getRouteDateKey()
      const isHistoryMode = Boolean(routeDateKey)
      const dateKey = routeDateKey || toDateKey(new Date())
      const words = getWordsByDate(dateKey)
      const progress = getProgress(dateKey)
      const cards = words.map((item) => ({
        ...item,
        revealed: false,
        exampleVisible: false,
        viewed: isWordViewed(item.id, progress),
      }))

      this.setData({
        dateKey,
        dateLabel: toDisplayDate(dateKey),
        summaryTitle: isHistoryMode ? `${toDisplayDate(dateKey)} 的单词` : '今天的 3 个单词',
        isHistoryMode,
        navBack: isHistoryMode,
        cards,
        currentIndex: 0,
        viewedCount: progress.viewedWordIds.length,
        completed: false,
        streak: getCurrentStreak(getHistory()),
        completionActionVisible: progress.completed && !isHistoryMode && isToday(dateKey),
        exitCountdownVisible: false,
        exitCountdown: 3,
        exitFallbackVisible: false,
      })
    },
    onSwiperChange(e: WechatMiniprogram.CustomEvent) {
      this.setData({ currentIndex: e.detail.current })
    },
    onToggleReveal(e: WechatMiniprogram.BaseEvent) {
      const id = Number(e.currentTarget.dataset.id)
      const cards = this.data.cards.map((item) => {
        if (item.id !== id) {
          return item
        }
        return { ...item, revealed: !item.revealed }
      })

      const target = cards.find((item) => item.id === id)
      if (target && target.revealed && !target.viewed) {
        const progress = markWordViewed(this.data.dateKey, id)
        const updatedCards = cards.map((item) => ({
          ...item,
          viewed: progress.viewedWordIds.includes(item.id),
        }))

        this.setData({
          cards: updatedCards,
          viewedCount: progress.viewedWordIds.length,
          completed: false,
          streak: getCurrentStreak(getHistory()),
          completionActionVisible: progress.completed && !this.data.isHistoryMode && isToday(this.data.dateKey),
        })
        return
      }

      this.setData({ cards })
    },
    onToggleExample(e: WechatMiniprogram.BaseEvent) {
      const id = Number(e.currentTarget.dataset.id)
      const cards = this.data.cards.map((item) => {
        if (item.id !== id) {
          return item
        }
        return { ...item, exampleVisible: !item.exampleVisible }
      })
      this.setData({ cards })
    },
    onPlayPronunciation(e: WechatMiniprogram.BaseEvent) {
      const word = String(e.currentTarget.dataset.word || '')
      if (!word || !audioCtx) {
        return
      }

      resetPlayback()
      audioCtx.stop()
      audioCtx.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
      audioCtx.play()
    },
    onPlayExample(e: WechatMiniprogram.BaseEvent) {
      const sentence = String(e.currentTarget.dataset.example || '')
      if (!sentence || !audioCtx) {
        return
      }

      const words = (sentence.match(/[A-Za-z']+/g) || [])
        .map((item) => item.replace(/[^A-Za-z]/g, '').toLowerCase())
        .filter((item) => item.length > 0)

      if (words.length === 0) {
        wx.showToast({ title: '例句不可播放', icon: 'none' })
        return
      }

      resetPlayback()
      audioCtx.stop()
      const urls = buildSentenceUrls(sentence)
      if (urls.length > 0) {
        playbackMode = 'sentence'
        sentenceUrls = urls
        sentenceCursor = 0
        playbackQueue = words
        queueCursor = 0
        playSentenceNext()
        return
      }

      playbackMode = 'wordQueue'
      playbackQueue = words
      queueCursor = 0
      playQueueNext()
    },
    goHistory() {
      wx.navigateTo({ url: '../logs/logs' })
    },
    onReviewAgain() {
      this.setData({
        currentIndex: 0,
        exitCountdownVisible: false,
      })
      clearExitCountdownTimer()
    },
    onStartExitCountdown() {
      clearExitCountdownTimer()
      this.setData({
        completionActionVisible: false,
        exitCountdownVisible: true,
        exitCountdown: 3,
        exitFallbackVisible: false,
      })
      exitCountdownTimer = setInterval(() => {
        const next = this.data.exitCountdown - 1
        if (next <= 0) {
          clearExitCountdownTimer()
          this.setData({ exitCountdown: 0 })
          this.tryExitMiniProgram()
          return
        }
        this.setData({ exitCountdown: next })
      }, 1000) as unknown as number
    },
    onCancelExitCountdown() {
      clearExitCountdownTimer()
      this.setData({
        exitCountdownVisible: false,
        completionActionVisible: true,
        exitCountdown: 3,
        exitFallbackVisible: false,
      })
    },
    onExitNow() {
      this.tryExitMiniProgram()
    },
    tryExitMiniProgram() {
      wx.exitMiniProgram({
        fail: () => {
          this.setData({
            exitFallbackVisible: true,
          })
          wx.showToast({
            title: '请点击立即退出',
            icon: 'none',
          })
        },
      })
    },
  },
})
