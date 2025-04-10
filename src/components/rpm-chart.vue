<template>
  <div>
    <canvas id="rpmChart"></canvas>
  </div>
</template>


<script setup>
import { ref } from 'vue';
import { Chart } from 'chart.js/auto';

const userActions = ref([]);
const rpm = ref([]);

let chartInstance = ref(null);

async function init(){
  userActions.value = [];
  rpm.value = [];
}
function recordAction(actionType) {
  userActions.value.push({
    type: actionType,
    timestamp: Date.now()
  });
}

function calculateRPM() {
  if (userActions.value.length === 0) {
    return;
  }
  const startTime = userActions.value[0].timestamp;
  const endTime = userActions.value[userActions.value.length - 1].timestamp;
  const durationMinutes = (endTime - startTime) / 60000;
  const minuteSlots = Math.max(1, Math.ceil(durationMinutes));
  const actionsPerMinute = Array(minuteSlots).fill(0);
  const labels = Array(minuteSlots).fill().map((_, i) => `${i + 1}分钟`);

  for (const action of userActions.value) {
    const minuteIndex = Math.min(
      minuteSlots - 1,
      Math.floor((action.timestamp - startTime) / 60000)
    );
    actionsPerMinute[minuteIndex]++;
  }
  rpm.value = {
    labels,
    data: actionsPerMinute
  };

  renderChart();

}

function renderChart() {
  if (!rpm.value.labels) {
    return;
  }
  destroyChar();
  createChart();
 
}

function createChart(){
  const ctx = document.getElementById('rpmChart').getContext('2d');
  chartInstance.value = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rpm.value.labels,
      datasets: [{
        label: '曲线：每分钟操作数',
        data: rpm.value.data,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: '游戏操作频率(RPM)'
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
            display: true,
            text: '操作次数'
          },
          ticks: {
            stepSize: 1
          }
        },
        x: {
          title: {
            display: true,
            text: '时间'
          }
        }
      }
    }
  });
}

function destroyChar(){
  if(chartInstance.value){
    chartInstance.value.destroy();
    chartInstance.value=null;
  }
}

defineExpose({
  init,
  recordAction,
  calculateRPM
});
</script>

