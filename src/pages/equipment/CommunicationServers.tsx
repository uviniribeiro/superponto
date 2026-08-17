import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { Server, Plus, Plug, Trash2, Pencil, Info, Clock, Download, CheckCircle2, XCircle, Cloud } from 'lucide-react';
import { useCommunicationServers, defaultServer, CommunicationServer } from '@/hooks/useCommunicationServers';

export default function CommunicationServers() {
  const {
    servers,
    isLoading,
    saveMutation,
    deleteMutation,
    testMutation,
    readRecordsMutation,
    syncClockMutation,
    cloudDevicesMutation,
  } = useCommunicationServers();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<CommunicationServer>>(defaultServer);

  const openNew = () => {
    setForm(defaultServer);
    setOpen(true);
  };

  const openEdit = (server: CommunicationServer) => {
    setForm(server);
    setOpen(true);
  };

  const isControlId = form.manufacturer === 'control_id';
  const isCloud = isControlId && form.connection_mode === 'cloud';
  const canSave = !!form.name?.trim() && (isCloud || !!form.host?.trim());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          icon={Server}
          title="Servidores de Comunicação"
          description="Comunicação direta com relógios Henry (TCP/IP) e Control iD (REST local ou iD Cloud)"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={openNew} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Servidor
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription>
          <strong>Henry:</strong> informe o servidor TCP/IP (ex.: 191.252.125.30) e a porta (padrão 3000).{' '}
          <strong>Control iD:</strong> escolha entre <em>API local</em> (endereço do equipamento, porta 80, usuário e
          senha) ou <em>iD Cloud</em> (token da organização). O servidor marcado como <strong>padrão</strong> preenche
          automaticamente IP e porta ao cadastrar novos equipamentos. IPs privados (192.168.x.x) só funcionam com o
          agente local (robô Control iD) ou habilitando "rede privada".
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Servidores cadastrados</CardTitle>
          <CardDescription>Teste a conexão, leia marcações e sincronize o relógio dos equipamentos.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : servers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum servidor cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Endereço TCP/IP</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Último teste</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servers.map((server) => (
                    <TableRow key={server.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{server.name}</span>
                          {server.is_default && <Badge variant="secondary">Padrão</Badge>}
                          {!server.is_active && <Badge variant="outline">Inativo</Badge>}
                        </div>
                        {server.description && (
                          <p className="text-xs text-muted-foreground">{server.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {server.host}:{server.port}
                      </TableCell>
                      <TableCell className="capitalize">{server.manufacturer}</TableCell>
                      <TableCell>
                        {server.last_test_status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                            <CheckCircle2 className="h-4 w-4" /> Online
                          </span>
                        ) : server.last_test_status ? (
                          <span className="inline-flex items-center gap-1 text-destructive text-sm">
                            <XCircle className="h-4 w-4" /> Falha
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nunca testado</span>
                        )}
                        {server.last_test_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(server.last_test_at).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testMutation.mutate({ serverId: server.id, manufacturer: server.manufacturer })}
                            disabled={testMutation.isPending}
                          >
                            <Plug className="h-3.5 w-3.5 mr-1" /> Testar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => readRecordsMutation.mutate({ serverId: server.id, manufacturer: server.manufacturer })}
                            disabled={readRecordsMutation.isPending}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" /> Marcações
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => syncClockMutation.mutate({ serverId: server.id, manufacturer: server.manufacturer })}
                            disabled={syncClockMutation.isPending}
                          >
                            <Clock className="h-3.5 w-3.5 mr-1" /> Relógio
                          </Button>
                          {server.manufacturer === 'control_id' && server.connection_mode === 'cloud' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cloudDevicesMutation.mutate({ serverId: server.id })}
                              disabled={cloudDevicesMutation.isPending}
                            >
                              <Cloud className="h-3.5 w-3.5 mr-1" /> Dispositivos
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEdit(server)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(server.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Servidor' : 'Novo Servidor de Comunicação'}</DialogTitle>
            <DialogDescription>
              Endereço TCP/IP usado para falar diretamente com os equipamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="srv-name">Nome *</Label>
                <Input
                  id="srv-name"
                  value={form.name ?? ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Servidor Henry Matriz"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="srv-manufacturer">Fabricante</Label>
                <Select
                  value={form.manufacturer ?? 'henry'}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      manufacturer: value,
                      connection_mode: value === 'control_id' ? 'device' : 'tcp',
                      port: value === 'control_id' ? 80 : form.port ?? 3000,
                    })
                  }
                >
                  <SelectTrigger id="srv-manufacturer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="henry">Henry</SelectItem>
                    <SelectItem value="control_id">Control iD</SelectItem>
                    <SelectItem value="generic">Genérico TCP/IP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isControlId && (
              <div className="space-y-2">
                <Label htmlFor="srv-mode">Modo de conexão</Label>
                <Select
                  value={form.connection_mode === 'cloud' ? 'cloud' : 'device'}
                  onValueChange={(value) => setForm({ ...form, connection_mode: value })}
                >
                  <SelectTrigger id="srv-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="device">API local do equipamento (REST)</SelectItem>
                    <SelectItem value="cloud">Control iD Cloud (iD Cloud)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="srv-host">Endereço IP / Host *</Label>
                <Input
                  id="srv-host"
                  value={form.host ?? ''}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="191.252.125.30"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="srv-port">Porta TCP</Label>
                <Input
                  id="srv-port"
                  type="number"
                  value={form.port ?? 3000}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 3000 })}
                />
              </div>
            </div>

            {isControlId && !isCloud && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="srv-user">Usuário do equipamento</Label>
                  <Input
                    id="srv-user"
                    value={form.api_username ?? ''}
                    onChange={(e) => setForm({ ...form, api_username: e.target.value })}
                    placeholder="admin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="srv-pass">Senha do equipamento</Label>
                  <Input
                    id="srv-pass"
                    type="password"
                    value={form.api_password ?? ''}
                    onChange={(e) => setForm({ ...form, api_password: e.target.value })}
                    placeholder={form.id ? 'Deixe em branco para manter' : 'admin'}
                  />
                </div>
              </div>
            )}

            {isControlId && isCloud && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="srv-cloud-url">URL da API iD Cloud</Label>
                  <Input
                    id="srv-cloud-url"
                    value={form.api_base_url ?? ''}
                    onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                    placeholder="https://api.idcloud.controlid.com.br"
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="srv-token">Token de acesso</Label>
                    <Input
                      id="srv-token"
                      type="password"
                      value={form.cloud_token ?? ''}
                      onChange={(e) => setForm({ ...form, cloud_token: e.target.value })}
                      placeholder={form.id ? 'Deixe em branco para manter' : 'Token da iD Cloud'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="srv-org">Organização (opcional)</Label>
                    <Input
                      id="srv-org"
                      value={form.cloud_organization_id ?? ''}
                      onChange={(e) => setForm({ ...form, cloud_organization_id: e.target.value })}
                      placeholder="ID da organização"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="srv-timeout">Tempo limite (ms)</Label>
                <Input
                  id="srv-timeout"
                  type="number"
                  value={form.timeout_ms ?? 8000}
                  onChange={(e) => setForm({ ...form, timeout_ms: parseInt(e.target.value) || 8000 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="srv-desc">Descrição</Label>
                <Input
                  id="srv-desc"
                  value={form.description ?? ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Servidor VPS com os REPs Henry"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label htmlFor="srv-default" className="text-sm">Servidor padrão</Label>
                <Switch
                  id="srv-default"
                  checked={!!form.is_default}
                  onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label htmlFor="srv-active" className="text-sm">Ativo</Label>
                <Switch
                  id="srv-active"
                  checked={form.is_active !== false}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>
              {isControlId && !isCloud && (
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <Label htmlFor="srv-https" className="text-sm">Usar HTTPS</Label>
                  <Switch
                    id="srv-https"
                    checked={!!form.use_https}
                    onCheckedChange={(checked) => setForm({ ...form, use_https: checked })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label htmlFor="srv-private" className="text-sm">Rede privada</Label>
                <Switch
                  id="srv-private"
                  checked={!!form.allow_private_network}
                  onCheckedChange={(checked) => setForm({ ...form, allow_private_network: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              disabled={!canSave || saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate(form, {
                  onSuccess: () => setOpen(false),
                })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
