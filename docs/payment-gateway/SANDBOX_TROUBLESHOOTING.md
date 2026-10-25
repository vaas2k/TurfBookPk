# Clink Sandbox Troubleshooting

Use this guide when testing the TurfBookPK 1-Bill workflow or reporting a problem to Clink. Never send CNICs, passwords, bearer tokens, billing addresses, or the server `.env` file.

## Expected workflow

1. `payment_billing_profile_saved` — TurfBookPK validated and encrypted the payer profile.
2. `payment_reference_generation_started` — the booking/order exists and its slots are held.
3. `clink_token_request_started` then `clink_token_request_succeeded` — Clink authentication succeeded.
4. `clink_reference_request_started` then `clink_reference_request_succeeded` — Clink returned an 18-digit ID.
5. `payment_reference_generation_completed` — TurfBookPK stored the Clink and consumer references.
6. `clink_acknowledgment_received` — Clink or the sandbox simulator reported payment.
7. `clink_acknowledgment_processed` — the booking, slot, ledger, event, and notifications were committed once.
8. `payment_status_checked` — the app refreshed the persisted state.

Every API response includes a `request_id`. Search server logs for that value to see the complete request path.

## Common error codes

| Code | Meaning | Action |
| --- | --- | --- |
| `payment_provider_unavailable` | Clink sandbox is not enabled on the running server. | Configure the server environment and restart it. No new checkout hold is created after the mobile preflight check. |
| `payment_provider_auth_failed` | Clink did not return a token. | Verify username, password, token URL, HTTP method, and parameter transport with Clink. |
| `payment_reference_rejected` | Clink definitely rejected the generation request. | Review the safe error message. TurfBookPK releases the checkout hold. |
| `payment_provider_invalid_response` | Clink returned non-JSON or an invalid 18-digit ID. | Send Clink the request ID, timestamp, endpoint, and expected response contract. |
| `payment_provider_unknown` | Timeout/network failure means Clink may or may not have generated a reference. | Do not retry automatically; use the admin manual-review queue and ask Clink to check `Applicant_Ref`. |
| `payment_under_review` | An earlier provider request is ambiguous. | Resolve the existing attempt before generating another reference. |
| `payment_hold_expired` | The local 30-minute hold ended. | Select the slot again if it remains available. |
| `billing_identity_in_use` | The CNIC fingerprint belongs to another TurfBookPK account. | Use the linked account or contact TurfBookPK support. |

## Information safe to send Clink

- UTC timestamp from the log.
- TurfBookPK `request_id`.
- `payment_attempt_id`.
- `Applicant_Ref`.
- Clink ID last six digits.
- Clink endpoint hostname.
- HTTP status and TurfBookPK error code.
- Whether the failure happened during token generation, reference generation, or acknowledgment.

Do not send raw application logs without checking redaction. Do not send the billing-profile request body.

## Sandbox payment workaround

Public banking applications cannot pay the provider's undeployed sandbox reference. Generate the reference normally and press **Simulate sandbox payment** on the payment-instructions screen. This owner-authenticated endpoint is enabled only when:

```env
PAYMENT_PROVIDER=clink
PAYMENT_ENVIRONMENT=sandbox
CLINK_ALLOW_UNVERIFIED_SANDBOX_ACK=true
```

It runs the same allocation, ledger, notification, and immutable-event transaction as an acknowledgment. Production mode refuses to start with this unsigned workflow.
