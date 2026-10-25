# Clink Sandbox API Contract Test Results

Tested directly from the TurfBookPK development terminal on 17–18 October 2026. No real payer data was used. Credentials, bearer values, CNICs, phone numbers, and complete payment references are intentionally excluded.

## Results

| Test | Result | Meaning |
| --- | --- | --- |
| `GET /Sandboxapi/Token` with an `application/x-www-form-urlencoded` body | HTTP `400`, JSON `invalid_grant` for deliberately invalid credentials | The unusual GET-with-body method documented by Clink is accepted by the sandbox. |
| `POST /Sandboxapi/Token` with the same form body | HTTP `400`, same JSON `invalid_grant` | POST is also accepted, but TurfBookPK continues using the provider's documented GET method. |
| `POST /Generate_ClinkID` without `Authorization` | HTTP `401`, JSON `Message: Authorization has been denied...` | Bearer authorization is enforced. |
| `POST /Generate_ClinkID` with an invalid bearer | HTTP `401`, same JSON denial | Invalid bearer values are rejected consistently. |
| TurfBookPK Clink adapter with invalid credentials | Safe `payment_provider_auth_failed`, HTTP-equivalent status `502` | The adapter maps the provider response clearly and does not expose the credential or response token. |
| Provider-issued credentials supplied on 18 October, tested with documented GET | HTTP `400`, JSON `invalid_grant`: username/password incorrect | The sandbox received and parsed the request but rejected the supplied credential pair. |
| Same provider-issued credentials tested with conventional POST | HTTP `400`, identical `invalid_grant` response | This rules out the unusual GET-with-body method as the cause of the authentication failure. |
| Provider-issued credentials retested after IP whitelisting on 18 October | HTTP `200`, bearer token returned with a 3,599-second lifetime | Sandbox authentication and IP whitelisting are working. The bearer value is intentionally not recorded. |
| `POST /Generate_ClinkID` with the documented identifiers and synthetic payer data | HTTP `200`, no `CLINK_ID`; provider rejected Master Category `1050010101` and Challan Category `105001010101` as invalid | Request authentication and JSON parsing work, but the categories documented in the supplied API PDF are not enabled/valid for this client credential. |
| Updated document: Client `1050`, Challan `105001`, existing category/consumer/amount-head identifiers | HTTP `200`; valid 18-digit `CLINK_ID` returned | The corrected client mapping works end to end. Prefixing the returned ID with biller code `100806` produces the required 24-digit consumer number. |

## Confirmed documentation details

- Sandbox token URL is reachable over HTTPS.
- Sandbox generation URL is reachable over HTTPS.
- Token request uses form-encoded fields: `grant_type`, `username`, and `password`.
- The generation endpoint requires JSON plus bearer authorization.
- The provider documents both `Error_detail` and `Error_Msg`; TurfBookPK accepts both, plus the authorization `Message` field.
- The document does not contain TurfBookPK's sandbox username/password. It says these are shared separately.

## Remaining application-level verification

A successful token and successful reference generation are now confirmed with the updated fixed values Client `1050` and Challan `105001`. The remaining end-to-end checks are:

1. Generate a reference through an authenticated TurfBookPK checkout rather than the direct provider request.
2. Simulate the acknowledgment locally, then verify booking, slot, ledger, event, notifications, duplicate callback status `2`, and admin visibility.
3. Repeat through a publicly reachable sandbox backend when Clink is ready to deliver its acknowledgment.

## Information to ask Clink about

Although both token methods currently work, Clink should confirm whether production officially supports GET request bodies or whether clients should use POST. They should also confirm whether HTTP status codes and error-field names will remain identical in production.

The obsolete Client `1038` / Challan `103801` mapping produced these provider validation errors:

- `11 - Master Category is not valid`
- `04 - Challan Category is not valid`

The updated provider document assigns Client `1050` / Challan `105001`; with that pair, the unchanged Master Category `1050010101` and Challan Category `105001010101` succeed. TurfBookPK now uses the corrected values by default.

## Version 1.1 expiration API

The 19 October 2026 revision adds `POST /Sandboxapi/api/CLINK/CLIENT/Mark_1Bill_Expired` with a fresh bearer token and JSON containing the 18-digit `Bill_No` plus `Consumer_ID`. TurfBookPK now maps its 15-minute slot hold to this API and releases the slot only after Clink confirms expiration (including the documented already-expired idempotent response). A live contract attempt on 22 October 2026 was blocked at token authentication, consistent with the sandbox IP whitelist no longer covering the current network; the expiration request was therefore not reached and must be rerun after Clink re-whitelists the current public IP.
