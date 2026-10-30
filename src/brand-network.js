import {
  brandCatalog,
  getBrandNetworkLinks,
  getPublicBrandSites,
} from 'meathill-brand';

const sites = getPublicBrandSites();

export const brandNetwork = {
  allProductsUrl: brandCatalog.directoryUrl,
  organization: brandCatalog.organization,
  sites,
  footerLinks: getBrandNetworkLinks('minesweeper'),
};
