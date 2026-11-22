-- Prova do aceite da Política de Privacidade, Termos de Uso e Termo de Dados de Terceiros (LGPD art. 8º, §2º):
-- histórico por usuário com versão, data/hora, IP e aparelho. Só inserção.
CREATE TABLE legal_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);
CREATE INDEX legal_consents_user_idx ON legal_consents(user_id, accepted_at DESC);
ALTER TABLE legal_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON legal_consents
  USING (app_bypass_rls() OR tenant_id = app_tenant_id())
  WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
CREATE TRIGGER legal_consents_immutable BEFORE UPDATE ON legal_consents FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
GRANT SELECT, INSERT ON legal_consents TO superponto_app;
