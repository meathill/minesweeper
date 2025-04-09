import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style/index.css';
import 'colors.css/src/_variables.css';

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
