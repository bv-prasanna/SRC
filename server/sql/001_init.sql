create table if not exists products (
 id bigint generated always as identity primary key,
 name varchar(150) not null,
 category varchar(100) not null,
 description varchar(1500) not null default '',
 image_url text,
 demo_video_url text,
 published boolean not null default false,
 fireworks boolean not null default true
);
create index if not exists products_published_name_idx on products(published,name);
