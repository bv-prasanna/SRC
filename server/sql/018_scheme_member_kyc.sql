-- SRC Scheme customer registration: plan-defined enrolment and protected PAN storage.
-- Historical free preference records may lack a linked plan and KYC fields; new API registrations require them.
ALTER TABLE festival_members
 ADD COLUMN IF NOT EXISTS address_line1 varchar(200),
 ADD COLUMN IF NOT EXISTS address_line2 varchar(200),
 ADD COLUMN IF NOT EXISTS city varchar(100),
 ADD COLUMN IF NOT EXISTS state varchar(100),
 ADD COLUMN IF NOT EXISTS pincode char(6),
 ADD COLUMN IF NOT EXISTS pan_ciphertext text,
 ADD COLUMN IF NOT EXISTS pan_digits varchar(4),
 ADD COLUMN IF NOT EXISTS pan_consent_at timestamptz,
 ADD COLUMN IF NOT EXISTS scheme_snapshot jsonb;
-- Separate registrations are allowed for different published plans even if they share a duration.
ALTER TABLE festival_members DROP CONSTRAINT IF EXISTS festival_member_unique_application;
CREATE UNIQUE INDEX IF NOT EXISTS festival_member_plan_phone_unique
 ON festival_members(scheme_plan_id,phone) WHERE scheme_plan_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_member_legacy_phone_unique
 ON festival_members(scheme_year,phone,duration_months) WHERE scheme_plan_id IS NULL;
-- Existing historical registrations are kept for reconciliation without inventing PAN/address data.
COMMENT ON COLUMN festival_members.pan_ciphertext IS 'AES-256-GCM PAN ciphertext; requires stable server-only SRC_PAN_ENCRYPTION_KEY (64 hex characters). Never expose through APIs.';
COMMENT ON COLUMN festival_members.scheme_snapshot IS 'Published scheme terms, amount and frequency at registration; does not authorize recurring payments.';
