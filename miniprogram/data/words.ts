import { CET6_DETAILS } from './cet6_details'
import { CET6_PHONETICS } from './cet6_phonetics'
import { CET6_WORDS } from './cet6_words'

export interface Word {
  id: number
  text: string
  phonetic: string
  meaning: string
  example: string
  exampleCn: string
}

function toExample(word: string): string {
  return `We should learn the word ${word} today.`
}

function toSinglePhonetic(raw: string): string {
  const text = (raw || '').trim()
  if (!text) {
    return ''
  }

  // Keep one clean phonetic only (prefer UK when both UK/US exist).
  const ukUs = text.match(/^UK\s+(.+?)\s{2,}US\s+.+$/i)
  if (ukUs && ukUs[1]) {
    return ukUs[1].trim()
  }

  if (/^UK\s+/i.test(text)) {
    return text.replace(/^UK\s+/i, '').trim()
  }

  if (/^US\s+/i.test(text)) {
    return text.replace(/^US\s+/i, '').trim()
  }

  return text
}

const FALLBACK_MEANING = '\u516d\u7ea7\u8bcd\u6c47\uff08\u91ca\u4e49\u5f85\u8865\u5145\uff09'

export const WORD_BANK: Word[] = CET6_WORDS.map((word, index) => {
  const detail = CET6_DETAILS[word]
  return {
    id: index + 1,
    text: word,
    phonetic: toSinglePhonetic(CET6_PHONETICS[word] || ''),
    meaning: detail && detail.meaning ? detail.meaning : FALLBACK_MEANING,
    example: detail && detail.example ? detail.example : toExample(word),
    exampleCn:
      detail && detail.exampleCn
        ? detail.exampleCn
        : `\u6211\u4eec\u4eca\u5929\u5e94\u8be5\u5b66\u4e60\u5355\u8bcd ${word}\u3002`,
  }
})
