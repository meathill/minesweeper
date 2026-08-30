import { brandCatalog, getBrandNetworkLinks, getPublicBrandSites } from '@meathill/brand';

export const brandNetwork = {
  allProductsUrl: brandCatalog.directoryUrl,
  organization: brandCatalog.organization,
  sites: getPublicBrandSites(),
  footerLinks: getBrandNetworkLinks('minesweeper'),
};
