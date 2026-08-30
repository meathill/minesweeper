import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useLearningStore = defineStore('learning', () => {
  const showProbability = ref(localStorage.getItem('learningMode') === '1')
  const probDisplay = ref(localStorage.getItem('probDisplay') || 'percent') // percent | fraction

  watch(showProbability, v => {
    localStorage.setItem('learningMode', v ? '1' : '0')
  })
  watch(probDisplay, v => {
    localStorage.setItem('probDisplay', v)
  })

  return { showProbability, probDisplay }
})
