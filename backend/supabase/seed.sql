-- Optional seed data
insert into public.offices (name, city, address, rating)
values
('Офис Центральный', 'Москва', 'ул. Ленина, 1', 95),
('Офис Южный', 'Краснодар', 'ул. Красная, 10', 88),
('Офис Северный', 'Санкт-Петербург', 'Невский пр., 25', 91)
on conflict do nothing;

insert into public.news (title, body, date, pinned, author)
values
('Обновление регламента выдачи займов', 'Новый регламент вступает в силу с 01.02.2025.', '2025-01-20', true, 'Директор'),
('Запуск нового продукта «Экспресс-займ»', 'С 1 марта запускаем новый продукт.', '2025-01-25', true, 'Директор')
on conflict do nothing;

insert into public.kb_articles (title, category, content, date)
values
('Процедура идентификации клиента', 'Регламенты', 'Подробная инструкция по идентификации клиента...', '2025-01-10'),
('Работа с кассовым аппаратом', 'Инструкции', 'Пошаговая инструкция по работе с ККТ...', '2025-01-05')
on conflict do nothing;

insert into public.courses (title, category, questions_count, passing_score)
values
('Основы микрофинансирования', 'Базовый', 20, 80),
('ПОД/ФТ (115-ФЗ)', 'Обязательный', 30, 90)
on conflict do nothing;