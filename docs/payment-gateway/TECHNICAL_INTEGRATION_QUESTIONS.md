# Clink Technical Integration Questions

The Payment Generation API v1.0 can generate a sandbox Clink ID, but these answers are required for a secure production integration.

## Authentication and generation

1. Is `/Token` really `GET` with form data in the body, or should it be `POST`?
2. May an access token be reused until `expires_in`, or must every payment request a new token?
3. Does `Applicant_Ref` enforce idempotency? Does retrying return the original Clink ID?
4. What are the API timeouts, rate limits, maintenance windows and credential-rotation procedure?
5. Are PKR amounts whole rupees or paisa/minor units, and are decimals accepted?

## Expiry and status

6. Can a Clink ID expire at an exact time instead of the end of `Due_Date`?
7. Which timezone controls expiry?
8. Is there an API to cancel/deactivate an unpaid Clink ID?
9. Is there an API to query unpaid, paid, expired, cancelled or reversed status?
10. How should a payment received after TurfBookPK's 30-minute hold be handled?

## Acknowledgment security

11. How do we authenticate callbacks: HMAC, shared-secret header, mTLS, signed token or IP allowlist?
12. What are the production webhook IP ranges and TLS requirements?
13. Are failed callbacks retried, and what are the schedule and maximum retry period?
14. Can callbacks be duplicated or arrive out of order?
15. Can the callback include paid amount, status, transaction ID, service charge, currency and timezone-qualified timestamp?
16. Is `text/plain` mandatory, or can Clink send `application/json`?

## Charges and payer data

17. How can we obtain the exact service charge and final payable amount before payment?
18. Is there a fee quotation API or documented fee table?
19. Why is real payer CNIC required, and what verification, retention and deletion rules apply?
20. Must payer CNIC match the paying account/wallet?
21. Does `Applicant_Father_Name` mean father name, company name or billing address?
22. What exactly should the QR code contain?

## Vendor settlement

23. Does settlement begin after payment or only after TurfBookPK releases it following the slot?
24. Please provide APIs for holding, releasing, checking and cancelling vendor settlement.
25. How are TurfBookPK commission and vendor share represented?
26. What vendor/sub-merchant KYC and bank documents are required?
27. Can you support gateway-managed vendor settlement and TurfBookPK-managed fallback payouts?
28. Confirm standard next-business-day settlement and the optional approximately eight-hour settlement fee.
29. What happens when vendor bank verification or settlement fails?

## Reconciliation and sandbox

30. Is there a transaction, refund and settlement reconciliation API/report?
31. Which reference links generation, acknowledgment, refund, settlement and reconciliation?
32. Please provide sandbox tests for success, pending, failure, duplicate/delayed callback, expiry, cancellation, refunds and failed settlement.
33. Please provide production URLs and the complete sandbox-to-production checklist.
