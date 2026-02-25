-- Обеспечиваем работу векторного поиска для нового префикса
CREATE OR REPLACE FUNCTION public.portalmkk_match_kb_article_chunks(
    query_embedding_text text,
    match_count integer,
    min_similarity double precision
)
RETURNS TABLE (
    id bigint,
    article_id bigint,
    content text,
    similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.article_id,
        c.content,
        1 - (c.embedding <=> query_embedding_text::vector) AS similarity
    FROM public.portalmkk_kb_article_chunks c
    WHERE 1 - (c.embedding <=> query_embedding_text::vector) > min_similarity
    ORDER BY c.embedding <=> query_embedding_text::vector
    LIMIT match_count;
END;
$$;
