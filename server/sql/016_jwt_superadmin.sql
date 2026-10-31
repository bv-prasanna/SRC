-- JWT session JWT IDs are hashed into the existing user_sessions table.
-- Existing opaque tokens will stop authenticating when the JWT middleware is deployed.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK(role IN
 ('SUPER_ADMIN','ADMIN','CUSTOMER','AGENT','DELIVERY','PROCUREMENT','PACKING','OPERATIONS'));
CREATE UNIQUE INDEX IF NOT EXISTS app_users_single_superadmin_idx ON app_users(role) WHERE role='SUPER_ADMIN';
-- Delete old opaque bearer sessions so JWT rollout invalidates existing logins.
DELETE FROM user_sessions;
