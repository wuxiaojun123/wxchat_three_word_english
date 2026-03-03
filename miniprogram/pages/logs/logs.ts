import { getCurrentStreak, getHistory } from '../../utils/learning'

Component({
  data: {
    streak: 0,
    history: [],
  },
  lifetimes: {
    attached() {
      this.loadHistory()
    },
  },
  pageLifetimes: {
    show() {
      this.loadHistory()
    },
  },
  methods: {
    loadHistory() {
      const history = getHistory()
      this.setData({
        history,
        streak: getCurrentStreak(history),
      })
    },
  },
})
