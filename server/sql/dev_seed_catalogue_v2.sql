-- SRC local DEMO ONLY. NOT for production/real inventory.
-- Safe to rerun. No prices, no warehouse stock, no paid orders or fireworks bookings.
BEGIN;
WITH demo(name,category,description,section_slug,image_url,fireworks) AS (VALUES
('Sparklers Collection - Demo','Sparklers','Illustrative festive catalogue; details confirmed in licensed store [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','crackers','https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=650&q=82&fit=crop',TRUE),
('Flower Pot Effects - Demo','Flower Pots','Product-information preview for lawful in-person retail [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','crackers','https://images.unsplash.com/photo-1513151233558-d860c5398176?w=650&q=82&fit=crop',TRUE),
('Ground Wheels - Demo','Ground Spinners','Illustrative product showcase; no online booking [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','crackers','https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=650&q=82&fit=crop',TRUE),
('Fountain Assortment - Demo','Fountains','Review demonstrations and product guidance [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','crackers','https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=650&q=82&fit=crop',TRUE),
('Festival Gift Assortment - Demo','Gift Packs','In-store catalogue information only [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','crackers','https://images.unsplash.com/photo-1513151233558-d860c5398176?w=650&q=82&fit=crop',TRUE),
('Colourful Sparklers - Demo','Sparklers','Educational product preview and safety information [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','crackers','https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=650&q=82&fit=crop',TRUE),
('Multipurpose Floor Cleaner - Demo','Floor Care','Illustrative 1 L cleaning essential; specifications to be confirmed [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1585421514738-01798e348b17?w=650&q=82&fit=crop',FALSE),
('Microfiber Cleaning Cloths - Demo','Cleaning Accessories','Reusable household and professional cleaning cloths [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=650&q=82&fit=crop',FALSE),
('Scourer Pad Set - Demo','Kitchen Cleaning','Cleaning accessories for daily kitchen maintenance [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1585421514738-01798e348b17?w=650&q=82&fit=crop',FALSE),
('Heavy-duty Garbage Bags - Demo','Waste Management','Bins and waste-collection accessories [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=650&q=82&fit=crop',FALSE),
('Broom & Dustpan - Demo','Cleaning Tools','Everyday floor-cleaning equipment [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=650&q=82&fit=crop',FALSE),
('Bathroom Cleaning Essentials - Demo','Bathroom Care','Cleaning products for homes and facilities [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1585421514738-01798e348b17?w=650&q=82&fit=crop',FALSE),
('Cotton Mop Refill - Demo','Floor Care','Maintenance supplies for cleaning operators [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=650&q=82&fit=crop',FALSE),
('Washroom Tissue Pack - Demo','Hygiene','Paper essentials for facilities and offices [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','housekeeping','https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=650&q=82&fit=crop',FALSE),
('A4 Spiral Notebook - Demo','Notebooks','Illustrative 172-page notebook for everyday use [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=650&q=82&fit=crop',FALSE),
('Blue Ballpoint Pen Set - Demo','Writing','Writing instruments for classrooms and offices [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1455390582262-044cdead277a?w=650&q=82&fit=crop',FALSE),
('A4 Copier Paper Ream - Demo','Office Paper','Printing and copying paper essentials [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=650&q=82&fit=crop',FALSE),
('Pencil & Eraser Kit - Demo','School Essentials','School stationery starter essentials [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1455390582262-044cdead277a?w=650&q=82&fit=crop',FALSE),
('Colour Marker Set - Demo','Art & Craft','Art and presentation supplies [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=650&q=82&fit=crop',FALSE),
('Desk Organizer - Demo','Office Essentials','Keep desk supplies organized [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=650&q=82&fit=crop',FALSE),
('Sticky Notes Pack - Demo','Office Essentials','Desk notes and reminders [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1455390582262-044cdead277a?w=650&q=82&fit=crop',FALSE),
('File Folder Set - Demo','Files & Storage','File management for offices and schools [LOCAL DEMO ITEM — illustrative image; no stock or price confirmed]','stationery','https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=650&q=82&fit=crop',FALSE)
)
INSERT INTO products(name,category,description,section_slug,image_url,fireworks,published,price_paise)
SELECT d.name,d.category,d.description,d.section_slug,d.image_url,d.fireworks,TRUE,0
FROM demo d
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name=d.name AND p.section_slug=d.section_slug);
COMMIT;
