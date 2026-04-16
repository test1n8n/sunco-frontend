export interface ProductDef {
  code: string;
  name: string;
  fullName: string;
  iceTicker: string;
  color: string;
  dropZoneLabel: string;
  isDiff: boolean;  // true = values are diffs vs LS Gasoil, false = outright/flat prices
}

export const PRODUCTS: ProductDef[] = [
  {
    code: 'G',
    name: 'LS Gasoil',
    fullName: 'Low Sulphur Gasoil',
    iceTicker: 'G',
    color: '#6366f1',
    dropZoneLabel: 'Drop ICE LS Gasoil PDF here, or click to select',
    isDiff: false,
  },
  {
    code: 'BRI',
    name: 'RME',
    fullName: 'Rapeseed Methyl Ether',
    iceTicker: 'BRI',
    color: '#f59e0b',
    dropZoneLabel: 'Drop ICE RME (BRI) PDF here, or click to select',
    isDiff: true,
  },
  {
    code: 'BFZ',
    name: 'FAME',
    fullName: 'Fatty Acid Methyl Ether',
    iceTicker: 'BFZ',
    color: '#10b981',
    dropZoneLabel: 'Drop ICE FAME (BFZ) PDF here, or click to select',
    isDiff: true,
  },
  {
    code: 'UCR',
    name: 'UCOME',
    fullName: 'Used Cooking Oil Methyl Ether',
    iceTicker: 'UCR',
    color: '#ef4444',
    dropZoneLabel: 'Drop ICE UCOME (UCR) PDF here, or click to select',
    isDiff: true,
  },
  {
    code: 'HVO',
    name: 'HVO',
    fullName: 'Hydrotreated Vegetable Oil',
    iceTicker: 'HVO',
    color: '#8b5cf6',
    dropZoneLabel: 'Drop ICE HVO PDF here, or click to select',
    isDiff: true,
  },
  {
    code: 'ZAF',
    name: 'SAF',
    fullName: 'Sustainable Aviation Fuel',
    iceTicker: 'ZAF',
    color: '#06b6d4',
    dropZoneLabel: 'Drop ICE SAF (ZAF) PDF here, or click to select',
    isDiff: false,
  },
  {
    code: 'SAR',
    name: 'SAF Diff',
    fullName: 'SAF FOB ARA Range (RED Compliant) vs LS Gasoil Diff',
    iceTicker: 'SAR',
    color: '#0891b2',
    dropZoneLabel: 'Drop ICE SAF Diff (SAR) PDF here, or click to select',
    isDiff: true,
  },
  // ── Flat / Outright price products ──
  {
    code: 'FAM',
    name: 'FAME0 Flat',
    fullName: 'FAME Zero Biodiesel FOB Rotterdam Future',
    iceTicker: 'FAM',
    color: '#059669',
    dropZoneLabel: 'Drop ICE FAME0 Flat (FAM) PDF here, or click to select',
    isDiff: false,
  },
  {
    code: 'ABI',
    name: 'RME Flat',
    fullName: 'Biodiesel RME FOB Rotterdam Future',
    iceTicker: 'ABI',
    color: '#d97706',
    dropZoneLabel: 'Drop ICE RME Flat (ABI) PDF here, or click to select',
    isDiff: false,
  },
  {
    code: 'BDB',
    name: 'UCOME Flat',
    fullName: 'Biodiesel UCOME FOB ARA Range (Red Compliant) Future',
    iceTicker: 'BDB',
    color: '#dc2626',
    dropZoneLabel: 'Drop ICE UCOME Flat (BDB) PDF here, or click to select',
    isDiff: false,
  },
  {
    code: 'BDA',
    name: 'HVO Flat',
    fullName: 'Biofuel HVO FOB ARA Range (Class II) Future',
    iceTicker: 'BDA',
    color: '#7c3aed',
    dropZoneLabel: 'Drop ICE HVO Flat (BDA) PDF here, or click to select',
    isDiff: false,
  },
];

/** All biodiesel products (excluding gasoil, flat outrights, and SAR diff) */
export const BIODIESEL_PRODUCTS = PRODUCTS.filter((p) => p.code !== 'G' && !['FAM', 'ABI', 'BDB', 'BDA', 'SAR'].includes(p.code));

/** Combined diff + flat product groups for analysis */
export interface CombinedProductGroup {
  name: string;
  diffCode: string;
  flatCode: string;
  diffColor: string;
  flatColor: string;
}

/** Flat color is a consistent light gray across all products for instant visual distinction */
export const FLAT_COLOR = '#94a3b8';  // slate-400 — neutral, contrasts with all product colors

export const COMBINED_PRODUCT_GROUPS: CombinedProductGroup[] = [
  { name: 'FAME0', diffCode: 'BFZ', flatCode: 'FAM', diffColor: '#10b981', flatColor: FLAT_COLOR },
  { name: 'RME',   diffCode: 'BRI', flatCode: 'ABI', diffColor: '#f59e0b', flatColor: FLAT_COLOR },
  { name: 'UCOME', diffCode: 'UCR', flatCode: 'BDB', diffColor: '#ef4444', flatColor: FLAT_COLOR },
  { name: 'HVO',   diffCode: 'HVO', flatCode: 'BDA', diffColor: '#8b5cf6', flatColor: FLAT_COLOR },
  { name: 'SAF',   diffCode: 'SAR', flatCode: 'ZAF', diffColor: '#0891b2', flatColor: FLAT_COLOR },
];
