-- Rode isso no SQL Editor do Supabase (projeto do painel M&Y) ANTES de
-- publicar o deploy com os novos campos do formulário de imóvel.
-- Todos os campos são opcionais (nullable), então não quebra nenhum imóvel
-- já cadastrado.

alter table public.imoveis
  add column if not exists quartos integer,
  add column if not exists banheiros integer,
  add column if not exists vagas integer,
  add column if not exists area_m2 numeric;

comment on column public.imoveis.quartos is 'Número de quartos (opcional)';
comment on column public.imoveis.banheiros is 'Número de banheiros (opcional)';
comment on column public.imoveis.vagas is 'Vagas de garagem (opcional)';
comment on column public.imoveis.area_m2 is 'Área do imóvel em m² (opcional)';
