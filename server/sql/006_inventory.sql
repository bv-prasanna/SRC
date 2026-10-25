CREATE TABLE IF NOT EXISTS stock_levels (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 product_id bigint NOT NULL REFERENCES products(id),
 warehouse_code varchar(60) NOT NULL,
 on_hand integer NOT NULL DEFAULT 0 CHECK(on_hand>=0),
 reorder_level integer NOT NULL DEFAULT 0 CHECK(reorder_level>=0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product_id,warehouse_code)
);
CREATE TABLE IF NOT EXISTS stock_movements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 stock_level_id bigint NOT NULL REFERENCES stock_levels(id),
 delta integer NOT NULL CHECK(delta<>0),
 reason varchar(120) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
