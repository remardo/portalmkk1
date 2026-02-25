-- 1. Сначала мы создаем функцию, которая безопасно копирует структуру и данные таблицы
CREATE OR REPLACE FUNCTION clone_table(source_table TEXT, target_table TEXT) RETURNS void AS $$
DECLARE
    column_list TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = target_table
    ) THEN
        -- Создаем структуру таблицы (включая индексы, дефолты и тд)
        EXECUTE format('CREATE TABLE public.%I (LIKE public.%I INCLUDING ALL)', target_table, source_table);
        
        -- Получаем список колонок минус генерируемые, чтобы не было ошибок при вставке
        SELECT string_agg(quote_ident(column_name), ', ')
        INTO column_list
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = source_table AND is_generated = 'NEVER';

        -- Копируем данные
        IF column_list IS NOT NULL THEN
            EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM public.%I', target_table, column_list, column_list, source_table);
        END IF;

        RAISE NOTICE 'Cloned % to %', source_table, target_table;
    ELSE
        RAISE NOTICE 'Table % already exists, skipping', target_table;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Теперь вызываем эту функцию для всех необходимых таблиц
DO $$
DECLARE
    t_name text;
    -- Список таблиц портала базы aftora
    tables_to_clone text[] := ARRAY[
        'audit_log',
        'offices',
        'profiles',
        'points_events',
        'points_action_rules',
        'points_campaigns',
        'notifications',
        'notification_integrations',
        'notification_delivery_log',
        'slo_alert_routing_policies',
        'sla_escalation_matrix',
        'tasks',
        'documents',
        'course_assignments',
        'course_attempts',
        'courses',
        'news',
        'news_images',
        'kb_articles',
        'kb_article_versions',
        'attestations',
        'document_approvals',
        'document_folders',
        'document_files',
        'shop_products',
        'shop_orders',
        'shop_order_items',
        'lms_courses',
        'lms_sections',
        'lms_subsections'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_clone
    LOOP
        -- Проверяем, существует ли исходная таблица перед копированием
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t_name) THEN
           PERFORM clone_table(t_name, 'portalmkk_' || t_name);
        ELSE
           RAISE NOTICE 'Source table % does not exist, skipping cloning to portalmkk_%', t_name, t_name;
        END IF;
    END LOOP;
END;
$$;
