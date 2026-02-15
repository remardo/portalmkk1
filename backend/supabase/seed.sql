-- Optional seed data (idempotent)
insert into public.offices (name, city, address, rating)
select v.name, v.city, v.address, v.rating
from (
  values
    ('Офис Центральный', 'Москва', 'ул. Ленина, 1', 95),
    ('Офис Южный', 'Краснодар', 'ул. Красная, 10', 88),
    ('Офис Северный', 'Санкт-Петербург', 'Невский пр., 25', 91)
) as v(name, city, address, rating)
where not exists (
  select 1
  from public.offices o
  where o.name = v.name
);

insert into public.news (title, body, date, pinned, author, status)
select v.title, v.body, v.date, v.pinned, v.author, v.status::public.news_status
from (
  values
    ('Обновление регламента выдачи займов', 'Новый регламент вступает в силу с 01.02.2025.', date '2025-01-20', true, 'Директор', 'published'),
    ('Запуск нового продукта «Экспресс-займ»', 'С 1 марта запускаем новый продукт.', date '2025-01-25', true, 'Директор', 'published')
) as v(title, body, date, pinned, author, status)
where not exists (
  select 1
  from public.news n
  where n.title = v.title
    and n.date = v.date
);

insert into public.kb_articles (title, category, content, date, status, version)
select
  v.title,
  v.category,
  v.content,
  v.date,
  v.status::public.kb_status,
  v.version
from (
  values
    (
      'Стандарты обслуживания клиента в МФО',
      'Общие правила',
      'Сотрудник обязан использовать понятные формулировки, вежливый тон и фиксировать все договоренности в учетной системе. Клиенту до подписания договора разъясняются: сумма займа, срок, полная стоимость кредита, график платежей, порядок досрочного погашения и последствия просрочки. Запрещено вводить клиента в заблуждение и скрывать обязательные условия.',
      date '2025-02-01',
      'published',
      1
    ),
    (
      'Идентификация клиента (KYC)',
      'Комплаенс',
      'Перед выдачей займа необходимо проверить документ, удостоверяющий личность, сверить персональные данные, подтвердить актуальность контактной информации и провести проверку по внутренним и внешним стоп-листам. При выявлении признаков недостоверности данных заявка направляется на ручную проверку и выдача приостанавливается.',
      date '2025-02-01',
      'published',
      1
    ),
    (
      'ПОД/ФТ: базовые действия сотрудника',
      'Комплаенс',
      'Операции клиента анализируются на предмет необычной активности. При наличии индикаторов риска сотрудник формирует внутреннее сообщение ответственному по ПОД/ФТ, не информируя клиента о факте проверки. Все действия фиксируются в журнале и в карточке клиента.',
      date '2025-02-01',
      'published',
      1
    ),
    (
      'Порядок оформления и выдачи займа',
      'Операции',
      'Оформление включает: прием заявки, скоринг, проверку платежеспособности, проверку ограничений, согласование условий, подписание документов и выдачу средств. До выдачи сотрудник обязан повторно сверить ключевые параметры договора и убедиться, что клиент получил экземпляр документов.',
      date '2025-02-02',
      'published',
      1
    ),
    (
      'Работа с просроченной задолженностью',
      'Взыскание',
      'При наступлении просрочки сотрудник действует по этапам: мягкое напоминание, информирование о сумме долга и вариантах урегулирования, предложение реструктуризации при наличии оснований. Коммуникация ведется только в разрешенные каналы и время, без угроз, давления и разглашения данных третьим лицам.',
      date '2025-02-02',
      'published',
      1
    ),
    (
      'Защита персональных данных клиента',
      'Информационная безопасность',
      'Персональные данные обрабатываются только для служебных целей и в рамках роли сотрудника. Запрещено передавать данные через незащищенные каналы, хранить клиентские документы на личных устройствах и использовать общие учетные записи. Любые инциденты безопасности немедленно эскалируются ответственному сотруднику.',
      date '2025-02-03',
      'published',
      1
    ),
    (
      'Кассовая дисциплина и работа с наличными',
      'Касса',
      'Операции с наличными выполняются в день обращения с обязательным оформлением кассовых документов. Сотрудник проверяет сумму, реквизиты операции и корректность отражения в системе. По окончании смены проводится сверка остатков и формируется отчетность. При расхождениях составляется акт и уведомляется руководитель офиса.',
      date '2025-02-03',
      'published',
      1
    ),
    (
      'Этика общения и урегулирование конфликтов',
      'Общие правила',
      'Сотрудник обязан сохранять нейтральный и уважительный стиль общения, не допускать дискриминационных высказываний и оценочных суждений. Конфликтные ситуации переводятся в конструктивный формат: фиксация обращения, предложение вариантов решения, передача старшему сотруднику при необходимости.',
      date '2025-02-03',
      'published',
      1
    )
) as v(title, category, content, date, status, version)
where not exists (
  select 1
  from public.kb_articles k
  where k.title = v.title
);

-- Replace legacy courses with LMS v2 courses
do $$
declare
  v_creator uuid;
  v_course_mfo bigint;
  v_course_1c bigint;
  v_section bigint;
begin
  select p.id
  into v_creator
  from public.profiles p
  order by case when p.role in ('admin', 'director') then 0 else 1 end, p.created_at nulls first
  limit 1;

  if v_creator is null then
    raise exception 'Seed requires at least one profile (admin/director preferred) to populate LMS courses';
  end if;

  -- Remove old LMS v1 data (legacy tables)
  delete from public.attestations;
  delete from public.course_attempts;
  delete from public.course_assignments;
  delete from public.course_questions;
  delete from public.courses;

  -- Clean LMS v2 data and rebuild from scratch
  delete from public.lms_subsection_progress;
  delete from public.lms_course_assignments;
  delete from public.lms_course_versions;
  delete from public.lms_media;
  delete from public.lms_subsections;
  delete from public.lms_sections;
  delete from public.lms_courses;

  insert into public.lms_courses (title, description, status, created_by)
  values (
    'Основы МФО',
    'Базовый курс по процессам МФО: клиентский путь, комплаенс, выдача и сопровождение займа.',
    'published',
    v_creator
  )
  returning id into v_course_mfo;

  insert into public.lms_sections (course_id, title, sort_order)
  values (v_course_mfo, 'Регулирование и стандарты', 1)
  returning id into v_section;

  insert into public.lms_subsections (section_id, title, sort_order, markdown_content)
  values
    (v_section, 'Роль сотрудника МФО', 1, '# Роль сотрудника МФО
Сотрудник обеспечивает прозрачность условий займа, соблюдение регламентов и понятную коммуникацию с клиентом.
- объясняем клиенту ПСК, срок и график платежей
- фиксируем договоренности в системе
- соблюдаем внутренние стандарты сервиса'),
    (v_section, 'KYC и базовый комплаенс', 2, '# KYC и комплаенс
Перед оформлением займа обязательно:
- проверка документа личности
- сверка контактных данных
- проверка по стоп-листам и внутренним правилам');

  insert into public.lms_sections (course_id, title, sort_order)
  values (v_course_mfo, 'Операционные процессы', 2)
  returning id into v_section;

  insert into public.lms_subsections (section_id, title, sort_order, markdown_content)
  values
    (v_section, 'Оформление и выдача займа', 1, '# Оформление займа
Последовательность процесса:
1. Прием заявки
2. Скоринг и проверка ограничений
3. Согласование условий
4. Подписание документов
5. Выдача средств'),
    (v_section, 'Работа с просрочкой', 2, '# Работа с просроченной задолженностью
Коммуникация с клиентом ведется корректно и в рамках закона:
- напоминаем о задолженности и сроках
- предлагаем варианты урегулирования
- фиксируем контакты и результат');

  insert into public.lms_courses (title, description, status, created_by)
  values (
    'Основы работы с 1С: конфигурация ''Аудит Эскорт: Управление микрофинансовой организацией''',
    'Практический курс по ежедневной работе в 1С для МФО: карточка клиента, договор, платежи, отчеты.',
    'published',
    v_creator
  )
  returning id into v_course_1c;

  insert into public.lms_sections (course_id, title, sort_order)
  values (v_course_1c, 'Старт работы в 1С', 1)
  returning id into v_section;

  insert into public.lms_subsections (section_id, title, sort_order, markdown_content)
  values
    (v_section, 'Навигация и роли', 1, '# Навигация и роли в 1С
В конфигурации используются ролевые права:
- оператор видит свои рабочие формы
- руководитель офиса контролирует показатели офиса
- администратор управляет настройками'),
    (v_section, 'Карточка клиента', 2, '# Карточка клиента
В карточке клиента хранятся:
- персональные данные
- история заявок и договоров
- контакты и комментарии по взаимодействию');

  insert into public.lms_sections (course_id, title, sort_order)
  values (v_course_1c, 'Ежедневные операции', 2)
  returning id into v_section;

  insert into public.lms_subsections (section_id, title, sort_order, markdown_content)
  values
    (v_section, 'Регистрация договора займа', 1, '# Регистрация договора
Проверьте корректность параметров:
1. сумма и срок займа
2. график платежей
3. ставка и ПСК
4. статус договора после проведения'),
    (v_section, 'Платежи и закрытие займа', 2, '# Платежи и закрытие
При приеме платежа:
- проверьте договор и остаток долга
- корректно распределите сумму по начислениям
- зафиксируйте результат в документе операции');

  insert into public.lms_sections (course_id, title, sort_order)
  values (v_course_1c, 'Отчеты и контроль', 3)
  returning id into v_section;

  insert into public.lms_subsections (section_id, title, sort_order, markdown_content)
  values
    (v_section, 'Операционные отчеты', 1, '# Операционные отчеты
Базовый набор отчетов:
- выдачи за период
- просроченная задолженность
- платежная дисциплина портфеля'),
    (v_section, 'Контроль качества данных', 2, '# Контроль качества данных
Ежедневно проверяйте:
- полноту клиентских реквизитов
- корректность статусов договоров
- отсутствие незакрытых технических операций');
end
$$;
