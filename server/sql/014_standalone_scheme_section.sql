-- SRC storefront: four independent departments in the requested order.
-- Scheme is a standalone REGISTRATION page, not a product/order/payment category.
INSERT INTO business_sections(slug,name,description,commerce_mode,active,sort_order)
VALUES('scheme','Scheme','Deepavali festival membership registration and in-store verification. No online contributions or product reservations.','CATALOGUE_ONLY',true,10)
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,commerce_mode='CATALOGUE_ONLY',active=true,sort_order=10;
UPDATE business_sections SET sort_order=20 WHERE slug='stationery';
UPDATE business_sections SET sort_order=30 WHERE slug='housekeeping';
UPDATE business_sections SET sort_order=40,commerce_mode='CATALOGUE_ONLY' WHERE slug='crackers';
