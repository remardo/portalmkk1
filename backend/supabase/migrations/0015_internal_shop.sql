create table if not exists public.shop_products (
  id bigint generated always as identity primary key,
  name text not null,
  description text null,
  category text not null,
  is_material boolean not null default true,
  price_points int not null check (price_points > 0),
  stock_qty int null check (stock_qty is null or stock_qty >= 0),
  is_active boolean not null default true,
  image_emoji text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id bigint generated always as identity primary key,
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  office_id bigint null references public.offices(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_points int not null check (total_points > 0),
  delivery_info text null,
  comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.shop_orders(id) on delete cascade,
  product_id bigint not null references public.shop_products(id) on delete restrict,
  product_name text not null,
  quantity int not null check (quantity > 0),
  price_points int not null check (price_points > 0),
  subtotal_points int not null check (subtotal_points > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists shop_products_name_uniq_idx on public.shop_products (lower(name));
create index if not exists shop_products_active_idx on public.shop_products (is_active, category, price_points);
create index if not exists shop_orders_buyer_idx on public.shop_orders (buyer_user_id, created_at desc);
create index if not exists shop_orders_office_idx on public.shop_orders (office_id, created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders (status, created_at desc);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);
create index if not exists shop_order_items_product_idx on public.shop_order_items (product_id);

insert into public.shop_products (name, description, category, is_material, price_points, stock_qty, is_active, image_emoji)
values
  ('Кружка брендированная', 'Керамическая кружка с логотипом компании', 'Сувениры', true, 300, 120, true, '☕'),
  ('Футболка корпоративная', 'Хлопковая футболка с фирменным принтом', 'Одежда', true, 700, 90, true, '👕'),
  ('Худи корпоративное', 'Теплое худи с логотипом', 'Одежда', true, 1500, 40, true, '🧥'),
  ('Термос металлический', 'Термос 500 мл', 'Сувениры', true, 900, 60, true, '🫖'),
  ('Блокнот А5', 'Брендированный блокнот в твердой обложке', 'Канцелярия', true, 250, 200, true, '📓'),
  ('Рюкзак городской', 'Рюкзак с отделением для ноутбука', 'Аксессуары', true, 1800, 35, true, '🎒'),
  ('Плед офисный', 'Мягкий плед для отдыха', 'Дом', true, 1300, 25, true, '🧶'),
  ('Powerbank 10000 mAh', 'Внешний аккумулятор', 'Техника', true, 2200, 20, true, '🔋'),
  ('Наушники беспроводные', 'Bluetooth-наушники', 'Техника', true, 2500, 18, true, '🎧'),
  ('Флешка 64GB', 'USB накопитель', 'Техника', true, 500, 110, true, '💾'),
  ('Зонт складной', 'Компактный зонт', 'Аксессуары', true, 950, 70, true, '☂️'),
  ('Сумка-шоппер', 'Текстильная сумка с логотипом', 'Аксессуары', true, 450, 140, true, '🛍️'),
  ('Бутылка для воды', 'Спортивная бутылка 700 мл', 'Сувениры', true, 600, 100, true, '🧴'),
  ('Настольная лампа', 'LED лампа для рабочего стола', 'Дом', true, 1700, 22, true, '💡'),
  ('Подарочный набор кофе', 'Набор зернового кофе', 'Подарки', true, 1200, 30, true, '☕'),
  ('Выходной на 1 день', 'Дополнительный оплачиваемый выходной', 'Привилегии', false, 4000, null, true, '🏖️'),
  ('Поздний старт на 2 часа', 'Начало рабочего дня на 2 часа позже', 'Привилегии', false, 900, null, true, '⏰'),
  ('Ранний уход на 2 часа', 'Завершение рабочего дня на 2 часа раньше', 'Привилегии', false, 900, null, true, '🚶'),
  ('Онлайн-курс по выбору', 'Оплата онлайн-курса до 3000 ₽', 'Обучение', false, 2500, null, true, '🎓'),
  ('Сертификат Ozon', 'Электронный сертификат номиналом 3000 ₽', 'Сертификаты', false, 3000, null, true, '🎁'),
  ('Сертификат Яндекс Еда', 'Электронный сертификат номиналом 2000 ₽', 'Сертификаты', false, 2000, null, true, '🍔'),
  ('Билеты в кино', '2 билета в кинотеатр', 'Досуг', false, 1800, null, true, '🎬'),
  ('Абонемент в спортзал', '1 месяц посещений', 'Здоровье', false, 3500, null, true, '🏋️'),
  ('Консультация психолога', 'Онлайн-сессия 60 минут', 'Здоровье', false, 2200, null, true, '🧠'),
  ('День без звонков', 'Рабочий день без входящих звонков', 'Привилегии', false, 1200, null, true, '🔕'),
  ('Сессия с наставником', 'Индивидуальная консультация 1 час', 'Развитие', false, 1500, null, true, '🧭'),
  ('Сессия с директором', 'Персональная встреча 30 минут', 'Развитие', false, 2800, null, true, '💼'),
  ('Доступ к конференции', 'Билет на профильную конференцию', 'Обучение', false, 3200, null, true, '🎤'),
  ('Бонусный обед', 'Корпоративный обед за счет компании', 'Питание', false, 800, null, true, '🍽️'),
  ('Мастер-класс', 'Групповой практический мастер-класс', 'Обучение', false, 1600, null, true, '🛠️')
on conflict do nothing;
