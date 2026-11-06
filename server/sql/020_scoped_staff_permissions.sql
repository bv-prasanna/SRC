-- Explicit staff permissions independent of the customer's base app role.
-- SUPER_ADMIN/ADMIN retain global administration; delegated staff get only named scopes.
CREATE TABLE IF NOT EXISTS user_staff_scopes (
  user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  scope varchar(96) NOT NULL CHECK (scope='scheme' OR scope ~ '^section:[a-z][a-z0-9-]{1,63}$'),
  granted_by bigint REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,scope)
);
CREATE INDEX IF NOT EXISTS user_staff_scopes_scope_idx ON user_staff_scopes(scope);
CREATE TABLE IF NOT EXISTS user_staff_scope_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  actor_user_id bigint REFERENCES app_users(id) ON DELETE SET NULL,
  previous_scopes jsonb NOT NULL,
  next_scopes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
