# Manual Supporter Workflow

## Goal

Web monetization is currently handled as:

- in-app supporter request
- manual bank transfer confirmation
- manual Pro activation in Supabase

No PG, Stripe Checkout, or Stripe Billing Portal is used for the live web flow.

## Supabase tables

- `public.supporter_requests`
- `public.profiles`

## Daily operator steps

1. Open Supabase Table Editor.
2. Check the newest rows in `supporter_requests`.
3. Match the request `depositor_name` and `support_amount` against the bank transfer record.
4. When the transfer is confirmed:
   - set `supporter_requests.status = 'verified'`
   - set `supporter_requests.verified_at = now()`
   - set `supporter_requests.verified_by = <admin user uuid>` if you want an audit trail
5. Update the matching row in `profiles`:
   - for permanent Pro: `plan = 'pro'`, `subscription_status = 'active'`, `ai_quota = 50`
   - for time-boxed Pro trial: keep `plan = 'free'`, set `subscription_status = 'active'`, `ai_quota = 50`, `pro_expires_at = <future timestamp>`
6. When a trial expires:
   - set `supporter_requests.status = 'expired'` if needed
   - set `profiles.subscription_status = 'inactive'`
   - set `profiles.ai_quota = 3`
   - clear `profiles.pro_expires_at`

## Notes

- The app treats a user as Pro when either `profiles.plan = 'pro'` or `profiles.pro_expires_at > now()`.
- If you want a Pro period to expire automatically, do not leave `plan = 'pro'` on that user. Use `pro_expires_at` instead.
- `supporter_requests.status = 'pending'` rows can be edited by the user from the web UI.
