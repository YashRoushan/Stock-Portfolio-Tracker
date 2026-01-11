export const toCents = (amount: number): number => Math.round(amount * 100);

export const fromCents = (cents: number): number => cents / 100;

export const mulCents = (centsPerUnit: number, quantity: number): number => {
  return Math.round(centsPerUnit * quantity);
};
