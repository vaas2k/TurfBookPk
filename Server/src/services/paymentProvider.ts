import { randomUUID } from 'node:crypto';
import { AppError } from '../helpers/errors.js';

export interface PaymentConfirmationInput {
  bookingId: string;
  amount: number;
  requestedReference?: string | null;
}

export interface PaymentConfirmation {
  provider: string;
  providerReference: string;
  status: 'paid';
  paidAt: Date;
}

export interface PaymentProvider {
  confirm(input: PaymentConfirmationInput): Promise<PaymentConfirmation>;
}

export class MockPaymentProvider implements PaymentProvider {
  async confirm(input: PaymentConfirmationInput): Promise<PaymentConfirmation> {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('payment_provider_required', 'Mock payment confirmation is disabled in production', 403);
    }
    return {
      provider: 'mock',
      providerReference: input.requestedReference?.trim().slice(0, 128) || `mock-${input.bookingId}-${randomUUID().slice(0, 8)}`,
      status: 'paid',
      paidAt: new Date(),
    };
  }
}
