'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ShieldCheck, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input, useToast } from './ui';

/** Verificação em duas etapas (aplicativo autenticador: Google Authenticator, Microsoft Authenticator, Authy…). */
export function MfaCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const st = useQuery({ queryKey: ['mfa'], queryFn: () => api<{ enrolled: boolean; recoveryCodesLeft: number }>('/auth/mfa') });
  const [enroll, setEnroll] = useState<{ secret: string; uri: string } | null>(null);
  const [svg, setSvg] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  useEffect(() => { if (enroll) void QRCode.toString(enroll.uri, { type: 'svg', margin: 1, width: 180 }).then(setSvg); }, [enroll]);
  const start = useMutation({ mutationFn: () => api<{ secret: string; uri: string }>('/auth/mfa/enroll', { method: 'POST' }), onSuccess: (r) => { setEnroll(r); setCode(''); }, onError: (e: Error) => toast('error', e.message) });
  const confirm = useMutation({ mutationFn: () => api<{ recoveryCodes: string[] }>('/auth/mfa/confirm', { method: 'POST', json: { code } }), onSuccess: (r) => { setCodes(r.recoveryCodes); setEnroll(null); qc.invalidateQueries({ queryKey: ['mfa'] }); }, onError: (e: Error) => toast('error', e.message) });
  const disable = useMutation({ mutationFn: () => api('/auth/mfa/disable', { method: 'POST', json: { code } }), onSuccess: () => { setDisabling(false); setCode(''); qc.invalidateQueries({ queryKey: ['mfa'] }); toast('success', 'Verificação em duas etapas desativada'); }, onError: (e: Error) => toast('error', e.message) });
  const regen = useMutation({ mutationFn: () => api<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', { method: 'POST' }), onSuccess: (r) => setCodes(r.recoveryCodes), onError: (e: Error) => toast('error', e.message) });

  return (
    <Card className="space-y-4 p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="size-5 text-brand" />Verificação em duas etapas</h2>
      {codes ? (
        <div className="space-y-3 text-sm">
          <p>Guarde estes códigos de recuperação num lugar seguro. Cada um entra <b>uma vez</b> se você perder o celular. Eles não aparecem de novo.</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-hover p-3 font-mono text-xs">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(codes.join('\n')); toast('success', 'Copiado'); }}><Copy className="size-4" />Copiar</Button><Button onClick={() => setCodes(null)}>Já guardei</Button></div>
        </div>
      ) : !st.data ? null : st.data.enrolled ? (
        <div className="space-y-3 text-sm">
          <p className="text-success">Ativada. O login pede o código do aplicativo depois da senha.</p>
          <p className="text-muted">Códigos de recuperação restantes: {st.data.recoveryCodesLeft}</p>
          {disabling ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); disable.mutate(); }}>
              <Input label="Código atual do aplicativo" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
              <div className="flex gap-2"><Button type="submit" variant="danger" loading={disable.isPending}>Desativar</Button><Button type="button" variant="ghost" onClick={() => setDisabling(false)}>Cancelar</Button></div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => regen.mutate()} loading={regen.isPending}>Novos códigos de recuperação</Button><Button variant="ghost" onClick={() => setDisabling(true)}>Desativar</Button></div>
          )}
          <p className="text-xs text-subtle">Para desativar ou gerar novos códigos, é preciso ter entrado com o código nesta sessão.</p>
        </div>
      ) : enroll ? (
        <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); confirm.mutate(); }}>
          <p>1. No aplicativo autenticador, leia o QR code (ou digite a chave).</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl bg-white p-2" aria-label="QR code" dangerouslySetInnerHTML={{ __html: svg }} />
            <code className="break-all rounded-xl bg-hover p-2 text-xs">{enroll.secret}</code>
          </div>
          <p>2. Digite o código de 6 dígitos que aparece no aplicativo.</p>
          <Input label="Código" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
          <div className="flex gap-2"><Button type="submit" loading={confirm.isPending}>Ativar</Button><Button type="button" variant="ghost" onClick={() => setEnroll(null)}>Cancelar</Button></div>
        </form>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted">Proteja sua conta: além da senha, o login pede um código que muda a cada 30 segundos no seu celular. Recomendado para administradores.</p>
          <Button onClick={() => start.mutate()} loading={start.isPending}><Smartphone className="size-4" />Ativar</Button>
        </div>
      )}
    </Card>
  );
}
