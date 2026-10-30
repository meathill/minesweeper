<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { brandNetwork } from './brand-network.js';

const { locale, t } = useI18n();

const isZh = computed(() => locale.value === 'zh');
const labels = computed(() =>
  isZh.value
    ? {
        privacy: '隐私政策',
        terms: '服务条款',
        about: '关于我们',
        contact: '联系方式',
        nav: '产品网络',
        all: '全部产品',
      }
    : {
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        about: 'About',
        contact: 'Contact',
        nav: 'Product network',
        all: 'All Products',
      },
);
</script>

<template>
  <footer class="brand-footer">
    <div class="brand-footer-inner">
      <div>
        <a class="brand-footer-name" :href="brandNetwork.organization.url">Meathill Studio</a>
        <p>© {{ new Date().getFullYear() }} {{ brandNetwork.organization.legalName }}. {{ t('footer.rights') }}</p>
        <p class="mt-2 text-xs">
          <a href="https://meathill.com" target="_blank" rel="noopener">meathill.com</a>
          · <a href="https://meathill.com/privacy" target="_blank" rel="noopener">{{ labels.privacy }}</a>
          · <a href="https://meathill.com/terms" target="_blank" rel="noopener">{{ labels.terms }}</a>
          · <a href="https://meathill.com/about" target="_blank" rel="noopener">{{ labels.about }}</a>
          · <a href="https://meathill.com/contact" target="_blank" rel="noopener">{{ labels.contact }}</a>
        </p>
      </div>
      <nav :aria-label="labels.nav" class="brand-footer-links">
        <a v-for="site in brandNetwork.footerLinks" :href="site.url" :key="site.id">{{ site.name }}</a>
        <a :href="brandNetwork.allProductsUrl">{{ labels.all }}</a>
      </nav>
    </div>
  </footer>
</template>
