/**
 * Adapters barrel export
 * @module adapters
 */

export { BaseAdapter, SyncOptions, SyncResult, getYesterdayDate, toNumber } from './base.adapter.js';
export { MetaAdapter, metaAdapter, MetaSyncOptions } from './meta.adapter.js';
export { Ga4Adapter, ga4Adapter, Ga4SyncOptions } from './ga4.adapter.js';
export { ShopifyAdapter, shopifyAdapter, ShopifySyncOptions } from './shopify.adapter.js';
