-- LOCAL DEMONSTRATION DATA ONLY. Not live inventory, not real prices or offers.
-- Run only in a disposable development database.
INSERT INTO products(name,category,description,published,fireworks,section_slug,price_paise)
SELECT item.name,item.category,item.description,true,false,item.section_slug,0
FROM (VALUES
('Floor Cleaning Liquid - Demo','Floor Care','Sample catalogue entry. Confirm size and price with SRC.','housekeeping'),
('Microfiber Cleaning Cloth - Demo','Cleaning Accessories','Sample catalogue entry. No stock or price represented.','housekeeping'),
('Garbage Bags - Demo','Waste Management','Sample catalogue entry. No stock or price represented.','housekeeping'),
('Broom and Dustpan Set - Demo','Cleaning Tools','Sample catalogue entry. No stock or price represented.','housekeeping'),
('A4 Notebook - Demo','Notebooks','Sample catalogue entry. No stock or price represented.','stationery'),
('Ballpoint Pen Pack - Demo','Writing Instruments','Sample catalogue entry. No stock or price represented.','stationery'),
('A4 Copy Paper - Demo','Office Paper','Sample catalogue entry. No stock or price represented.','stationery'),
('Pencil and Eraser Kit - Demo','School Supplies','Sample catalogue entry. No stock or price represented.','stationery')
) AS item(name,category,description,section_slug)
WHERE NOT EXISTS(SELECT 1 FROM products p WHERE p.name=item.name AND p.section_slug=item.section_slug);
