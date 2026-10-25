# Clink Refund and Cancellation Questions

Please answer these questions in writing so TurfBookPK can implement refunds safely and explain the process clearly to players and ground owners.

## Starting a refund

1. Can TurfBookPK start a refund through an API, or must we contact your support team?
2. Do you support both full and partial refunds?
3. Which value identifies the original payment when requesting a refund: Clink ID, 1-Bill consumer number, gateway transaction ID, or another reference?
4. Can one payment covering several ground slots be refunded separately for only one cancelled slot?
5. What prevents the same refund request from being processed twice?

## Refund result and timing

6. Which refund statuses should our system expect, for example pending, completed, rejected, or failed?
7. Will Clink send TurfBookPK a callback when a refund completes or fails?
8. Is there an API we can call to check refund status?
9. How many business days does a refund normally take for each supported bank or wallet channel?
10. Is there a deadline after payment beyond which a refund cannot be requested?
11. If a refund fails, who retries it and how is TurfBookPK informed?

## Amounts and cancellation situations

12. Is the 1-Bill service charge refundable, and are there additional refund fees?
13. How are service charges handled for partial refunds?
14. What happens when the merchant balance is not enough to cover a refund?
15. How should we handle payment received after a booking or payment reference expired?
16. Can TurfBookPK immediately deactivate an unpaid Clink ID when checkout is abandoned?
17. What process applies to vendor cancellation, system failure, force majeure, disputed service, or a closed ground?
18. If vendor settlement already happened, can Clink recover the refundable amount from that vendor?

## Operations and testing

19. Who communicates with the player when a refund is delayed or fails?
20. What support SLA and escalation contact applies to failed refunds?
21. Which refund/cancellation reconciliation reports are available?
22. Please provide sandbox examples for full, partial, duplicate, rejected and failed refunds, plus payment received after expiry.
23. Please provide the refund API, authentication, request/response examples, callbacks, error codes and retry rules.

TurfBookPK will not mark a payment as refunded until Clink confirms successful completion.
