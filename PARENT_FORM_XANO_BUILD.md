# Ads Journey — Parent form Xano contract (v1)
Status: **Frontend committed; Xano tables/endpoints not built or tested yet.**
Xano base: https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT
Parent page: parent_form.html (public GitHub Pages). Never place inquiry IDs, names, or contact details in a form URL.
Only use fake franchise **53** and fake inquiries for initial tests. Never modify master_sales_intent.
All admin API routes require ads-jouney bearer authentication and franchise authorization; public routes require a securely generated high-entropy opaque link token.

## Xano tables

### ad_parent_form_request
- id: integer auto PK
- created_at: timestamp
- updated_at: timestamp
- ad_inquiry_id: integer required
- ad_journey_id: integer required
- franchise_id: integer required
- created_by_user_id: integer required
- request_token: text, **unique**, at least 128 bits unpredictable (prefer 256 bits random encoded base64url), never a numeric ID or derived from IDs. Do not expose hashable sequential info.
- schedule_type: enum **visit** / **trial**
- status: enum **open** / **submitted** / **expired**
- expires_at: timestamp required (suggest 14 days)
- submitted_at: timestamp optional
Store full request token privately in Xano. Compare securely. Rate limit public lookups. Consider storing a hash instead if supported.

### ad_parent_form_submission
- id: integer auto PK
- created_at: timestamp
- ad_parent_form_request_id: integer required
- ad_inquiry_id: integer required
- ad_journey_id: integer required
- franchise_id: integer required
- parent_name: text
- child_name: text
- age_years: integer
- age_months: integer
- city: text
- address: text optional
- contact_number: text
- preferred_date: text YYYY-MM-DD optional
- preferred_time: text optional (may be a range, e.g. 9:00 AM–10:30 AM)
- notes: text optional
- status: enum **awaiting_schedule** / **scheduled**
- scheduled_at: timestamp optional
- scheduled_by_user_id: integer optional
- schedule_event_id: integer optional
Keep every submission permanently. One request token may submit only once; another request can create another submission. A corrected submission must not overwrite the original.
For database uniqueness, one submission per ad_parent_form_request_id.

## Endpoints (exact names and response shapes frontend expects)

### POST ad_parent_form_link — authenticated
Input JSON:
{"ad_inquiry_id":637,"ad_journey_id":632,"schedule_type":"trial"}
Validate authorization, matching inquiry/journey/franchise, stage, closed flag and type. Reuse an open unexpired token for the same journey/type, or generate a new secure token.
Response (HTTP 200):
{"success":true,"token":"<RANDOM_BASE64URL_TOKEN_32PLUS_CHARS>","request_id":1}
Only this authenticated response contains the token. Frontend constructs parent_form.html?t=<token> using its own page origin. Never respond with test/dummy tokens. A failure must be non-200 or success=false.

### GET ad_parent_form_public?t=<token> — public, no admin auth
Validate token format and strict expiry/status. Return only:
{"valid":true,"schedule_type":"trial","branch_name":"Fake One"}
Do not include parent name, contact details, inquiry/journey IDs, or user IDs. Invalid or consumed tokens return non-200 OR {"valid":false,"status":"expired"}.
Add CORS for the public GitHub Pages origin, Cache-Control: no-store and public rate-limiting.

### POST ad_parent_form_submit — public, no admin auth
Body:
{"token":"<token>","parent_name":"Jessica","child_name":"Mia","age_years":2,"age_months":0,"city":"Tanauan City","address":"123 Main Street","contact_number":"09170000000","preferred_date":"2026-10-24","preferred_time":"9:00 AM to 10:30 AM","notes":""}
Validate token open/not expired, require parent_name child_name city and contact_number, integer age_years 0..12, age_months 0..11, enforce text length limits, optional date format and text length, block html/script content when rendering (frontend uses textContent). In a transaction: create submission in the linked inquiry/journey/franchise; update request to submitted; refuse second submission using same token.
Response (HTTP 200 or 201):
{"success":true,"submission_id":1234}
New submission status **awaiting_schedule**. No appointment is created or confirmed.

### GET ad_parent_form_submissions?ad_inquiry_id=<id> — authenticated
Authorize franchise/inquiry. Return chronological submissions, including already handled:
{"submissions":[{"id":1234,"ad_inquiry_id":637,"ad_journey_id":632,"parent_name":"Jessica","child_name":"Mia","age_years":2,"age_months":0,"city":"Tanauan City","address":"123 Main Street","contact_number":"09170000000","preferred_date":"2026-10-24","preferred_time":"9:00 AM to 10:30 AM","notes":"","status":"awaiting_schedule","submitted_at":179...}]}
Use timestamp in epoch milliseconds (matching current journey records). The frontend merges these into Conversation in chronological order, labels them **Website form submission**, and offers Review & Fill Schedule. These are **not Messenger messages**. They should also appear in History (either via ad_journey_event or a distinct form history event).

### GET ad_parent_form_pending — authenticated
Authorize franchise visibility. Return one or more pending submission rows for all accessible journeys; the frontend deduplicates by journey ID and sorts oldest first.
{"items":[{"id":1234,"ad_journey_id":632,"ad_inquiry_id":637,"facebook_name":"testing for fake one","parent_name":"Jessica","branch_name":"Fake One","schedule_type":"trial","status":"awaiting_schedule","submitted_at":179...}]}
Only return status awaiting_schedule. The frontend shows a persistent star on matching visible journey cards, a global Needs Attention counter (distinct journeys), and a queue opening the requested inquiry only on admin click. Poll every 20 seconds; never auto-open a journey.

### Existing POST ad_journey_schedule — extend transactionally
After the existing schedule save succeeds, update all **awaiting_schedule** submissions belonging to that journey:
status = scheduled, scheduled_at = server now, scheduled_by_user_id = authenticated user.id.
This change must happen on the backend as part of the confirmed schedule action. Do not clear on open, review, apply, unsuccessful save, copied link, or draft creation. The client emits a refresh event only after confirmed success.
Record audit event with the linked submission(s). Preserve all historical submissions.

## Test acceptance (fake franchise 53 only)
1. Unauthorized callers cannot mint links or read pending submissions.
2. Fake inquiry/link request yields random opaque unique token, with matching visit/trial and branch.
3. Public form opens only valid, open, unexpired token.
4. Parent submits phone, names, age including months, city/address, date and time range. After submit, same token cannot be used again.
5. Submission appears in existing Conversation timeline with correct timestamp and full details.
6. Star and Needs Attention count appear after submission, including after logout and admin shift change.
7. Opening/reviewing does NOT clear star.
8. Admin applies form details to left Visit/Trial form. Nothing saved until Save Schedule.
9. Successful schedule clears star and counter, retains form submission in Conversation and History.
10. Failed schedule leaves attention intact. Second request/submission later generates a new pending item.
