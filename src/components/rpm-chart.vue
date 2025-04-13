<template>
  <div>
    <canvas id="rpmChart"></canvas>
  </div>
</template>

<script setup>
import { ref, toRefs, onMounted } from 'vue';
import { Chart } from 'chart.js/auto';

const props = defineProps({
  titleText: String,
  labelText: String,
  xText: String,
  yText: String,
  userActions: Array //结构: [{timestamp: Date.now(), type: 'OPEN'/'FLAG'},..]
});
const {titleText,  xText, yText, userActions} = toRefs(props);

const rpm = ref([]);

let chartInstance = ref(null);

onMounted(() => {
  calculateRPM();
  createChart();
});

function calculateRPM() {
  if (userActions.value.length === 0) {
    return;
  }
  const startTime = userActions.value[0].timestamp;
  const endTime = userActions.value[userActions.value.length - 1].timestamp;
  const durationMinutes = (endTime - startTime) / 60000;
  
  // 时间小于1分钟时使用秒级统计
  if (durationMinutes < 1) {
    const durationSeconds = (endTime - startTime) / 1000;
    // 多少秒为一个时间段
    const timeUnitSeconds = 5;
    const secondSlots = Math.max(2, Math.ceil(durationSeconds / timeUnitSeconds));
    const countPerUnit = Array(secondSlots).fill(0);
    const labels = Array(secondSlots).fill().map((_, i) => `${i * timeUnitSeconds}-${(i + 1) * timeUnitSeconds}秒`);

    for (const action of userActions.value) {
      const secondIndex = Math.min(
        secondSlots - 1,
        Math.floor((action.timestamp - startTime) / (timeUnitSeconds * 1000))
      );
      countPerUnit[secondIndex]++;
    }
    
    rpm.value = {
      labels,
      data: countPerUnit,
      isSecondsMode: true
    };
    return;
  }
  
  // 时间大于等于1分钟时使用分钟统计
  const minuteSlots = Math.max(1, Math.ceil(durationMinutes));
  
  const countPerUnit = Array(minuteSlots).fill(0);
  const labels = Array(minuteSlots).fill().map((_, i) => `${i + 1}分`);

  for (const action of userActions.value) {
    const minuteIndex = Math.min(
      minuteSlots - 1,
      Math.floor((action.timestamp - startTime) / 60000)
    );
    countPerUnit[minuteIndex]++;
  }
  rpm.value = {
    labels,
    data: countPerUnit,
    isSecondsMode: false
  };
}

function createChart(){
  const ctx = document.getElementById('rpmChart').getContext('2d');
  chartInstance.value = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rpm.value.labels,
      datasets: [{
        label: rpm.value.isSecondsMode ? '每5秒操作数' : '每分钟操作数',
        data: rpm.value.data,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: titleText.value ? true : false,
          text: titleText.value,
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: yText.value ? true : false,
            text: yText.value,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            stepSize: 1
          }
        },
        x: {
          title: {
            display: xText.value ? true : false,
            text: xText.value,
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        }
      }
    }
  });
}

</script>
