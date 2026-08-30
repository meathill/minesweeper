import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useLearningStore = defineStore('learning', () => {
  const showProbability = ref(localStorage.getItem('learningMode') === '1')
  // 独立复选框：% 和 分数可同时开/关，默认都关（仅颜色）
  const showPercent = ref(localStorage.getItem('showPercent') === '1')
  const showFraction = ref(localStorage.getItem('showFraction') === '1')
  // 兼容旧 probDisplay 迁移
  const oldDisplay = localStorage.getItem('probDisplay')
  if (oldDisplay && localStorage.getItem('showPercent') === null && localStorage.getItem('showFraction') === null) {
    if (oldDisplay === 'percent') showPercent.value = true
    else if (oldDisplay === 'fraction') showFraction.value = true
  }

  watch(showProbability, v => {
    localStorage.setItem('learningMode', v ? '1' : '0')
  })
  watch(showPercent, v => {
    localStorage.setItem('showPercent', v ? '1' : '0')
  })
  watch(showFraction, v => {
    localStorage.setItem('showFraction', v ? '1' : '0')
  })

  return { showProbability, showPercent, showFraction }
})
