import {ref} from 'vue';
import { Chart } from 'chart.js/auto';
const showChart = ref(false);//是否显示用户操作频率图
const userActions = ref([]);//记录用户操作
const rpm = ref([]);//记录用户操作频率


function recordAction(actionType) {
    userActions.value.push({
        type: actionType,
        timestamp: Date.now()
    });
}

function calculateRPM() {
    if(userActions.value.length === 0) {
        return;
    }
    const startTime = userActions.value[0].timestamp;
    const endTime = userActions.value[userActions.value.length - 1].timestamp;
    const durationMinutes = (endTime - startTime) / 60000;
    const minuteSlots = Math.max(1, Math.ceil(durationMinutes));
    const actionsPerMinute = Array(minuteSlots).fill(0);
    const labels = Array(minuteSlots).fill().map((_, i) => `${i+1}分钟`);

    for(const action of userActions.value) {
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

function renderChart(chartInstance) {
    if(!rpm.value.labels || chartInstance) {
        return;
    }
    const ctx = document.getElementById('rpmChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: rpm.value.labels,
            datasets: [{
                label: '用户操作频率',
                data: rpm.value.data,
                fill: false,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '游戏操作频率(RPM)'
                },
                tooltop: {
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
    })
}

export {recordAction,renderChart,showChart,userActions,rpm,calculateRPM}