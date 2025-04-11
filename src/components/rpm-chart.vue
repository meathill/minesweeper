<template>
  <div>
    <canvas id="rpmChart"></canvas>
  </div>
</template>


<script setup>
import { ref, toRefs, onMounted, onBeforeUnmount } from 'vue';
import { Chart } from 'chart.js/auto';

const props = defineProps({
  titleText: String,
  labelText: String,
  xText: String,
  yText: String,
  userActions: Array
});
const {titleText, labelText, xText, yText, userActions} = toRefs(props);

const rpm = ref([]);

let chartInstance = ref(null);

onMounted(() => {
  calculateRPM();
  createChart();
});

onBeforeUnmount(() => {
  destroyChart();
});

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

}

function createChart(){
  const ctx = document.getElementById('rpmChart').getContext('2d');
  chartInstance.value = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rpm.value.labels,
      datasets: [{
        label: labelText.value,
        data: rpm.value.data,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: titleText.value
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
            text: yText.value
          },
          ticks: {
            stepSize: 1
          }
        },
        x: {
          title: {
            display: true,
            text: xText.value
          }
        }
      }
    }
  });
}

function destroyChart(){
  if(chartInstance.value){
    chartInstance.value.destroy();
    chartInstance.value=null;
  }
}

</script>

<script>
export function recordAction(actions, actionType) {
  actions.value.push({
    type: actionType,
    timestamp: Date.now()
  });
}
export const actionType = Object.freeze({
  OPEN: 'open',
  FLAG: 'flag'
})
</script>
