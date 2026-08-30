<script setup>
import { brandNetwork } from './brand-network.js';
</script>

<template>
  <footer class="brand-footer">
    <div class="brand-footer-inner">
      <div>
        <a class="brand-footer-name" :href="brandNetwork.organization.url">Meathill Studio</a>
        <p>© {{ new Date().getFullYear() }} {{ brandNetwork.organization.legalName }}. 边玩边学。</p>
        <p class="mt-2 text-xs">
          <a href="https://meathill.com" target="_blank" rel="noopener">meathill.com</a>
          · <a href="https://meathill.com/privacy" target="_blank" rel="noopener">隐私政策</a>
          · <a href="https://meathill.com/terms" target="_blank" rel="noopener">服务条款</a>
          · <a href="https://meathill.com/about" target="_blank" rel="noopener">关于我们</a>
          · <a href="https://meathill.com/contact" target="_blank" rel="noopener">联系方式</a>
        </p>
      </div>
      <nav aria-label="产品网络" class="brand-footer-links">
        <a v-for="site in brandNetwork.footerLinks" :href="site.url" :key="site.id">{{ site.name }}</a>
        <a :href="brandNetwork.allProductsUrl">全部产品</a>
      </nav>
    </div>
  </footer>
</template>
