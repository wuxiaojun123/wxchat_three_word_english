import { CET6_DETAILS } from './cet6_details'
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

export const WORD_BANK: Word[] = CET6_WORDS.map((word, index) => {
  const detail = CET6_DETAILS[word]
  return {
    id: index + 1,
    text: word,
    phonetic: '',
    meaning: detail && detail.meaning ? detail.meaning : '六级词汇（释义待补充）',
    example: detail && detail.example ? detail.example : toExample(word),
    exampleCn: detail && detail.exampleCn ? detail.exampleCn : `我们今天应该学习单词 ${word}。`,
  }
})
