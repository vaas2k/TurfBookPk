export interface SmsMessage {
  to: string;
  body: string;
}

/**
 * Gateway boundary for future OTP delivery (for example, a Pakistan-capable SMS provider).
 * Provider credentials and HTTP integration deliberately stay outside OTP business rules.
 */
export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

export class DevelopmentSmsProvider implements SmsProvider {
  async send(_message: SmsMessage): Promise<void> {
    // OTP delivery is intentionally handled by the configured development code for now.
  }
}
