-- Criar bucket para fotos de ponto
INSERT INTO storage.buckets (id, name, public) VALUES ('time-clock-photos', 'time-clock-photos', true);

-- RLS para fotos de ponto
CREATE POLICY "Users can upload their own photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'time-clock-photos' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view time clock photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'time-clock-photos');

-- Adicionar coluna de foto na tabela de registros
ALTER TABLE public.time_records ADD COLUMN photo_url TEXT;