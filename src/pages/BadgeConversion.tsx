// Crachás e códigos de barras: lê crachás já existentes (leitor USB/Bluetooth ou câmera), vincula o código
// antigo ao funcionário (passa a valer no terminal) e emite o código de barras do sistema, com impressão.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Badge as BadgeIcon, Camera, CameraOff, Link2, Loader2, Printer, ScanLine, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { scanVideoFrame } from '@/lib/barcodeScan';

const db = supabase as any;
type Person = { id: string; name: string; reg: string | null; barcode: string | null; legacy: string | null };

function barcodeSvg(code: string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try { JsBarcode(svg, code, { format: 'CODE128', height: 50, fontSize: 13, margin: 4, width: 1.6 }); } catch { /* código incompatível */ }
  return new XMLSerializer().serializeToString(svg);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function BadgeConversion() {
  const { company } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [code, setCode] = useState('');
  const [scanned, setScanned] = useState<string | null>(null);
  const [owner, setOwner] = useState<{ person: Person; kind: 'legacy' | 'system' } | null | undefined>(undefined);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [camOn, setCamOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!company?.id) return;
    const [{ data: profs }, { data: methods }] = await Promise.all([
      db.from('profiles').select('id, full_name, registration_number').eq('company_id', company.id).eq('is_active', true).order('full_name').limit(5000),
      db.from('employee_identification_methods').select('profile_id, method_type, identifier, is_active').eq('company_id', company.id).in('method_type', ['barcode', 'badge_legacy']),
    ]);
    const by = new Map<string, { barcode?: string; legacy?: string }>();
    for (const m of methods ?? []) {
      if (!m.is_active) continue;
      const cur = by.get(m.profile_id) ?? {};
      if (m.method_type === 'barcode') cur.barcode = m.identifier; else cur.legacy = m.identifier;
      by.set(m.profile_id, cur);
    }
    setPeople((profs ?? []).map((p: any) => ({ id: p.id, name: p.full_name, reg: p.registration_number, barcode: by.get(p.id)?.barcode ?? null, legacy: by.get(p.id)?.legacy ?? null })));
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  const lookup = useCallback((raw: string) => {
    const c = raw.trim();
    if (!c) return;
    setScanned(c);
    const p = people.find((x) => x.legacy === c || x.barcode === c);
    setOwner(p ? { person: p, kind: p.legacy === c ? 'legacy' : 'system' } : null);
    setCode('');
    inputRef.current?.focus();
  }, [people]);

  // Câmera traseira para ler crachás
  useEffect(() => {
    if (!camOn) return;
    let stop = false;
    let last = '';
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => undefined); }
        while (!stop) {
          await new Promise((r) => setTimeout(r, 300));
          if (!videoRef.current || !canvasRef.current) continue;
          const c = await scanVideoFrame(videoRef.current, canvasRef.current, 'any');
          if (c && c !== last) { last = c; lookup(c); }
        }
      } catch {
        toast.error('Não foi possível abrir a câmera.');
        setCamOn(false);
      }
    })();
    return () => { stop = true; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [camOn, lookup]);

  const upsert = async (profileId: string, type: 'barcode' | 'badge_legacy', identifier: string) => {
    const { error } = await db.from('employee_identification_methods').upsert(
      { profile_id: profileId, company_id: company?.id, method_type: type, identifier, is_active: true },
      { onConflict: 'profile_id,method_type' },
    );
    if (error) throw error;
  };

  const link = async (p: Person) => {
    if (!scanned) return;
    setBusy(true);
    try {
      await upsert(p.id, 'badge_legacy', scanned);
      toast.success(`Crachá ${scanned} vinculado a ${p.name}: já vale no terminal.`);
      await load();
      setOwner({ person: { ...p, legacy: scanned }, kind: 'legacy' });
    } catch (e: any) {
      toast.error(e?.code === '23505' ? 'Este código já pertence a outro funcionário.' : e?.message ?? 'Erro ao vincular');
    } finally {
      setBusy(false);
    }
  };

  const issue = async (p: Person) => {
    setBusy(true);
    try {
      // O banco gera o código (13 dígitos, único): o valor enviado é só um marcador.
      await upsert(p.id, 'barcode', `novo-${crypto.randomUUID()}`);
      toast.success(`Código de barras do sistema gerado para ${p.name}.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao gerar');
    } finally {
      setBusy(false);
    }
  };

  const print = (list: Person[]) => {
    const ok = list.filter((p) => p.barcode);
    if (!ok.length) return toast.error('Gere o código de barras do sistema antes de imprimir.');
    const cards = ok.map((p) => `<div class="card"><div class="name">${esc(p.name)}</div><div class="reg">${p.reg ? `Matrícula ${esc(p.reg)}` : ''} · ${esc(company?.name ?? '')}</div><div class="bc">${barcodeSvg(p.barcode!)}</div></div>`).join('');
    const w = window.open('', '_blank');
    if (!w) return toast.error('Permita janelas pop-up para imprimir os crachás.');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Crachás</title><style>@page{margin:8mm}body{font-family:Arial,sans-serif;margin:0;display:flex;flex-wrap:wrap;gap:6mm}.card{width:85.6mm;height:54mm;border:1px solid #bbb;border-radius:3mm;padding:4mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid}.name{font-weight:700;font-size:13pt}.reg{color:#555;font-size:9pt}.bc svg{width:100%;height:auto}</style></head><body>${cards}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
    w.document.close();
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? people.filter((p) => `${p.name} ${p.reg ?? ''} ${p.barcode ?? ''} ${p.legacy ?? ''}`.toLowerCase().includes(t)) : people;
  }, [people, q]);

  return (
    <div className="space-y-6">
      <PageHeader title="Crachás e códigos de barras" description="Leia crachás já existentes, vincule ao funcionário e emita o código de barras do sistema." icon={BadgeIcon} />
      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-5">
          <p className="font-semibold">1. Ler o crachá</p>
          <form onSubmit={(e) => { e.preventDefault(); lookup(code); }} className="flex flex-wrap gap-2">
            <div className="relative min-w-[260px] flex-1">
              <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={inputRef} autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passe o crachá no leitor ou digite o código" className="pl-9" />
            </div>
            <Button type="submit" variant="secondary">Buscar</Button>
            <Button type="button" variant="outline" onClick={() => setCamOn((v) => !v)}>{camOn ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}{camOn ? 'Fechar câmera' : 'Usar câmera'}</Button>
          </form>
          {camOn && <video ref={videoRef} className="max-h-72 w-full rounded-2xl border object-cover" muted playsInline autoPlay />}
          <canvas ref={canvasRef} className="hidden" />
          {scanned && owner && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="font-semibold">{owner.kind === 'legacy' ? 'Crachá antigo' : 'Código do sistema'} de {owner.person.name}{owner.person.reg ? ` (matrícula ${owner.person.reg})` : ''}</p>
              {owner.person.barcode
                ? <><span dangerouslySetInnerHTML={{ __html: barcodeSvg(owner.person.barcode) }} className="inline-block rounded bg-white p-1 [&_svg]:h-16 [&_svg]:w-auto" /><Button size="sm" variant="outline" onClick={() => print([owner.person])}><Printer className="mr-2 h-4 w-4" />Imprimir crachá</Button></>
                : <Button size="sm" onClick={() => issue(owner.person)} disabled={busy}>Gerar código do sistema</Button>}
            </div>
          )}
          {scanned && owner === null && (
            <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 font-medium">O código <strong>{scanned}</strong> ainda não pertence a ninguém: escolha o funcionário abaixo e toque em <em>Vincular crachá lido</em>.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 font-semibold">2. Funcionários e códigos</p>
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, matrícula ou código" className="pl-9" />
            </div>
            <Button onClick={() => print(people.filter((p) => sel.has(p.id)))} disabled={!sel.size}><Printer className="mr-2 h-4 w-4" />Imprimir selecionados ({sel.size})</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10"><Checkbox checked={shown.length > 0 && shown.every((p) => sel.has(p.id))} onCheckedChange={(v) => setSel(v ? new Set(shown.map((p) => p.id)) : new Set())} /></TableHead>
              <TableHead>Funcionário</TableHead><TableHead>Matrícula</TableHead><TableHead>Código do sistema</TableHead><TableHead>Crachá antigo</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shown.slice(0, 400).map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Checkbox checked={sel.has(p.id)} onCheckedChange={(v) => { const n = new Set(sel); if (v) n.add(p.id); else n.delete(p.id); setSel(n); }} /></TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.reg ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{p.barcode ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{p.legacy ?? '—'}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {scanned && owner === null && <Button size="sm" onClick={() => link(p)} disabled={busy}><Link2 className="mr-1 h-3.5 w-3.5" />Vincular crachá lido</Button>}
                    <Button size="sm" variant="outline" onClick={() => issue(p)} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p.barcode ? 'Novo código' : 'Gerar código'}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {shown.length > 400 && <p className="text-sm text-muted-foreground">Mostrando 400 de {shown.length}: use a busca.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
