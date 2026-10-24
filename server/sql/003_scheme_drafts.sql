-- Internal business planning only; no member enrollment, subscription or collection.
CREATE TABLE IF NOT EXISTS scheme_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(120) NOT NULL,
 section_slug varchar(64) NOT NULL REFERENCES business_sections(slug),
 duration_months integer NOT NULL CHECK(duration_months BETWEEN 1 AND 60),
 frequency varchar(12) NOT NULL CHECK(frequency IN('MONTHLY','QUARTERLY')),
 amount_paise integer NOT NULL CHECK(amount_paise>0),
 internal_notes text NOT NULL DEFAULT '',
 status varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(status='DRAFT'),
 created_at timestamptz NOT NULL DEFAULT now()
);
