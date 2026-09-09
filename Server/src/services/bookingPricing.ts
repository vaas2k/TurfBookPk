export interface BookingPriceSplit {
  totalAmount: number;
  platformFee: number;
  vendorAmount: number;
}

export function calculateBookingPrice(totalAmount: number, commissionBps: number): BookingPriceSplit {
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 0) throw new Error('Total amount must be a non-negative integer');
  if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new Error('Commission basis points must be an integer between 0 and 10000');
  }
  const platformFee = Math.round((totalAmount * commissionBps) / 10_000);
  return { totalAmount, platformFee, vendorAmount: totalAmount - platformFee };
}
