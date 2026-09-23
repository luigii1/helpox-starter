// The commander's Polar sandbox organization's two products (brick E1),
// wired here as the single source of truth for what a purchase buys —
// pricing display (the marketing page) and, later, the webhook handler
// (brick E4) both read from this instead of keeping their own copies.
//
// Swap these ids for a product's own Polar organization's real product ids
// when copying this base (see README.md's "Starting a new product" guide);
// never reuse another product's ids or keys.
export type CreditPack = {
  polarProductId: string;
  credits: number;
  priceEur: number;
};

export const CREDIT_PACKS: CreditPack[] = [
  { polarProductId: "6a7960c1-e346-4057-8fb2-9760484477ec", credits: 5, priceEur: 4.99 },
  { polarProductId: "d2aec929-1dc5-49c5-bdc5-556ebe50c422", credits: 12, priceEur: 9.99 },
];

export function creditsForProductId(polarProductId: string): number | null {
  return CREDIT_PACKS.find((pack) => pack.polarProductId === polarProductId)?.credits ?? null;
}
