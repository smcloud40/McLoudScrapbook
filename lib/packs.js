// Server-trusted pack pricing. The client sends pack IDs; prices are always
// looked up here, never taken from the browser, so a tampered client request
// can't buy a pack for less than it costs.
export const PACKS = {
  'bg-basics':    { name: 'Basics',             priceCents: 0,   free: true },
  'bg-autumn':    { name: 'Cozy autumn',        priceCents: 300, free: false },
  'bg-farmhouse': { name: 'Farmhouse florals',  priceCents: 250, free: false },
  'st-everyday':  { name: 'Everyday',           priceCents: 0,   free: true },
  'st-autumn':    { name: 'Cozy autumn',        priceCents: 300, free: false },
  'st-travel':    { name: 'Travel',             priceCents: 250, free: false },
  'ft-basics':    { name: 'Basics',             priceCents: 0,   free: true },
  'ft-script':    { name: 'Script pack',        priceCents: 200, free: false },
};
