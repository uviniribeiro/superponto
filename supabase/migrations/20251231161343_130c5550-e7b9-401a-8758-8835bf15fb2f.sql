-- Criar enum para tipo de organização
CREATE TYPE public.organization_type AS ENUM ('company', 'city_hall');

-- Criar enum para setores de prefeitura
CREATE TYPE public.city_hall_sector AS ENUM ('education', 'health', 'culture', 'transport', 'administration', 'finance', 'environment', 'social_assistance', 'urban_planning', 'other');

-- Adicionar colunas na tabela companies para suportar prefeituras
ALTER TABLE public.companies 
ADD COLUMN organization_type organization_type NOT NULL DEFAULT 'company',
ADD COLUMN sector city_hall_sector,
ADD COLUMN parent_organization_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Índice para buscar setores de uma prefeitura
CREATE INDEX idx_companies_parent_organization ON public.companies(parent_organization_id) WHERE parent_organization_id IS NOT NULL;

-- Índice para tipo de organização
CREATE INDEX idx_companies_organization_type ON public.companies(organization_type);