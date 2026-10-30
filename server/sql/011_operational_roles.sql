-- New roles and operational workflows for standard goods only.
-- Roles are deliberately disjoint to avoid accidental cross-department privileges.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
 CHECK(role IN ('CUSTOMER','AGENT','ADMIN','DELIVERY','PROCUREMENT','PACKING','OPERATIONS'));
CREATE TABLE IF NOT EXISTS operations_tasks(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES customer_orders(id),
 task_kind varchar(20) NOT NULL CHECK(task_kind IN ('PROCUREMENT','PACKING','DELIVERY')),
 status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_PROGRESS','COMPLETED')),
 assigned_to bigint REFERENCES app_users(id),
 instructions varchar(1000) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(order_id,task_kind)
);
CREATE INDEX IF NOT EXISTS operations_tasks_queue_idx ON operations_tasks(task_kind,status,assigned_to);
CREATE TABLE IF NOT EXISTS operations_task_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 task_id bigint NOT NULL REFERENCES operations_tasks(id),
 actor_id bigint NOT NULL REFERENCES app_users(id),
 old_status varchar(20) NOT NULL,
 new_status varchar(20) NOT NULL,
 notes varchar(1000) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
