-- Isolamento entre clientes reforçado: cada cliente só enxerga as próprias linhas, também nas tabelas
-- que antes dependiam só do filtro da API.

-- Usuários: um cliente não enxerga mais usuários sem cliente (o Super Admin da plataforma).
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (app_bypass_rls() OR tenant_id = app_tenant_id())
  WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());

-- Permissões de perfis: só as dos perfis visíveis (os do próprio cliente e os de sistema).
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_permissions;
CREATE POLICY tenant_isolation ON role_permissions
  USING (app_bypass_rls() OR role_id IN (SELECT id FROM roles))
  WITH CHECK (app_bypass_rls() OR role_id IN (SELECT id FROM roles WHERE tenant_id = app_tenant_id()));

-- Preferências de notificação: só as dos usuários do próprio cliente.
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notification_preferences;
CREATE POLICY tenant_isolation ON notification_preferences
  USING (app_bypass_rls() OR user_id IN (SELECT id FROM users))
  WITH CHECK (app_bypass_rls() OR user_id IN (SELECT id FROM users));

-- Servidor de comunicação: logs, histórico e credenciais só dos servidores visíveis ao cliente.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['communication_logs', 'communication_sync_history', 'communication_server_credentials'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (app_bypass_rls() OR server_id IN (SELECT id FROM communication_servers WHERE tenant_id = app_tenant_id()))
      WITH CHECK (app_bypass_rls() OR server_id IN (SELECT id FROM communication_servers WHERE tenant_id = app_tenant_id()))$p$, t);
  END LOOP;
END $$;
