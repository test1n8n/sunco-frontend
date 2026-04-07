export interface ProductDef {
  code: string;
  name: string;
  fullName: string;
  iceTicker: string;
  color: string;
  dropZoneLabel: string;
}

export const PRODUCTS: ProductDef[] = [
  {
    code: 'G',
    name: 'LS Gasoil',
    fullName: 'Low Sulphur Gasoil',
    iceTicker: 'G',
    color: '#6366f1',
    dropZoneLabel: 'Drop ICE LS Gasoil PDF here, or click to select',
  },
  {
    code: 'BRI',
    name: 'RME',
    fullName: 'Rapeseed Methyl Ether',
    iceTicker: 'BRI',
    color: '#f59e0b',
    dropZoneLabel: 'Drop ICE RME (BRI) PDF here, or click to select',
  },
  {
    code: 'BFZ',
    name: 'FAME',
    fullName: 'Fatty Acid Methyl Ether',
    iceTicker: 'BFZ',
    color: '#10b981',
    dropZoneLabel: 'Drop ICE FAME (BFZ) PDF here, or click to select',
  },
  {
    code: 'UCR',
    name: 'UCOME',
    fullName: 'Used Cooking Oil Methyl Ether',
    iceTicker: 'UCR',
    color: '#ef4444',
    dropZoneLabel: 'Drop ICE UCOME (UCR) PDF here, or click to select',
  },
  {
    code: 'HVO',
    name: 'HVO',
    fullName: 'Hydrotreated Vegetable Oil',
    iceTicker: 'HVO',
    color: '#8b5cf6',
    dropZoneLabel: 'Drop ICE HVO PDF here, or click to select',
  },
  {
    code: 'ZAF',
    name: 'SAF',
    fullName: 'Sustainable Aviation Fuel',
    iceTicker: 'ZAF',
    color: '#06b6d4',
    dropZoneLabel: 'Drop ICE SAF (ZAF) PDF here, or click to select',
  },
];

/** All biodiesel products (excluding gasoil) */
export const BIODIESEL_PRODUCTS = PRODUCTS.filter((p) => p.code !== 'G');
