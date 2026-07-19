import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, RefreshCw, CheckCircle2, XCircle, Camera, QrCode, ShieldAlert, Filter, FileDown, FileBarChart, ChevronRight, Search, Info, AlertTriangle, FileText, Archive } from 'lucide-react';
import { generateStandardPDF, addFooter, createA4PDF, getContentStartY } from '@/lib/pdfUtils';
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';



interface Attempt {
  id: string;
  user_id: string;
  profile_id: string | null;
  company_id: string | null;
  method_type: string;
  success: boolean;
  reason: string | null;
  identifier_matched: string | null;
  confidence: number | null;
  user_agent: string | null;
  created_at: string;
  profiles?: { full_name: string; registration_number: string | null } | null;
}

export default function ValidationAudit() {
  const { user, profile, isAdmin, isManager } = useAuth();
  const canSeeAll = isAdmin || isManager;

  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);

  const [fEmployee, setFEmployee] = useState<string>('all');
  const [fMethod, setFMethod] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [fStart, setFStart] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [fEnd, setFEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  // device_info-based filters (parsed from user_agent metadata)
  const [fDevEmployeeId, setFDevEmployeeId] = useState<string>('');
  const [fDevCompanyId, setFDevCompanyId] = useState<string>('');
  const [fDevTimezone, setFDevTimezone] = useState<string>('');
  const [fSearch, setFSearch] = useState<string>('');

  // Server-side pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const [searchParams] = useSearchParams();
  const focusedAttemptId = searchParams.get('attempt');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const buildBaseQuery = () => {
    let q = supabase
      .from('identification_validation_attempts')
      .select('*, profiles:profile_id(full_name, registration_number)', { count: 'exact' })
      .gte('created_at', `${fStart}T00:00:00`)
      .lte('created_at', `${fEnd}T23:59:59`)
      .order('created_at', { ascending: false });

    if (fMethod !== 'all') q = q.eq('method_type', fMethod);
    if (fStatus !== 'all') q = q.eq('success', fStatus === 'success');
    if (canSeeAll && fEmployee !== 'all') q = q.eq('profile_id', fEmployee);
    if (fDevEmployeeId.trim()) q = q.ilike('user_agent', `%profile_id=${fDevEmployeeId.trim()}%`);
    if (fDevCompanyId.trim()) q = q.ilike('user_agent', `%company_id=${fDevCompanyId.trim()}%`);
    if (fDevTimezone.trim()) q = q.ilike('user_agent', `%tz=${fDevTimezone.trim()}%`);
    if (fSearch.trim()) {
      const term = fSearch.trim().replace(/[%,]/g, '');
      q = q.or(`reason.ilike.%${term}%,user_agent.ilike.%${term}%,identifier_matched.ilike.%${term}%`);
    }
    return q;
  };

  const load = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await buildBaseQuery().range(from, to);
    if (error) {
      toast.error('Erro ao carregar auditoria: ' + error.message);
      setAttempts([]);
      setTotalCount(0);
    } else {
      setAttempts((data as unknown as Attempt[]) || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const loadEmployees = async () => {
    if (!canSeeAll) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');
    setEmployees(data || []);
  };

  useEffect(() => {
    loadEmployees();
  }, [canSeeAll]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fEmployee, fMethod, fStatus, fStart, fEnd, fDevEmployeeId, fDevCompanyId, fDevTimezone, fSearch, page, pageSize]);

  // Reset to first page whenever filters change
  useEffect(() => { setPage(1); }, [fEmployee, fMethod, fStatus, fStart, fEnd, fDevEmployeeId, fDevCompanyId, fDevTimezone, fSearch]);

  // Search is now applied server-side; keep alias for existing consumers
  const filteredAttempts = attempts;

  // Scroll to focused attempt from ?attempt=... (arriving from notification link)
  useEffect(() => {
    if (!focusedAttemptId || loading) return;
    const row = rowRefs.current[focusedAttemptId];
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('ring-2', 'ring-amber-500');
      const t = setTimeout(() => row.classList.remove('ring-2', 'ring-amber-500'), 4000);
      return () => clearTimeout(t);
    }
  }, [focusedAttemptId, loading, filteredAttempts]);

  const stats = useMemo(() => {
    const src = filteredAttempts;
    const total = src.length;
    const ok = src.filter(a => a.success).length;
    const fail = total - ok;
    const facial = src.filter(a => a.method_type === 'facial').length;
    const qr = src.filter(a => a.method_type === 'qrcode').length;
    return { total, ok, fail, facial, qr, rate: total ? Math.round((ok / total) * 100) : 0 };
  }, [filteredAttempts]);

  const [showDrilldown, setShowDrilldown] = useState(false);
  const [drillSearch, setDrillSearch] = useState('');
  const [drillPage, setDrillPage] = useState(1);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillRows, setDrillRows] = useState<Array<{ profile_id: string; name: string; facial_ok: number; facial_fail: number; qr_ok: number; qr_fail: number; divergence: number; total: number }>>([]);
  const [drillTotal, setDrillTotal] = useState(0);
  const DRILL_PAGE_SIZE = 10;

  const dailySeries = useMemo(() => {
    const map = new Map<string, { day: string; facial_ok: number; facial_fail: number; qr_ok: number; qr_fail: number }>();
    filteredAttempts.forEach(a => {
      const day = format(parseISO(a.created_at), 'dd/MM');
      const row = map.get(day) || { day, facial_ok: 0, facial_fail: 0, qr_ok: 0, qr_fail: 0 };
      const bucket =
        a.method_type === 'facial' ? (a.success ? 'facial_ok' : 'facial_fail')
        : a.method_type === 'qrcode' ? (a.success ? 'qr_ok' : 'qr_fail')
        : null;
      if (bucket) (row as any)[bucket]++;
      map.set(day, row);
    });
    return Array.from(map.values()).reverse();
  }, [filteredAttempts]);

  // Client-side consolidated used by CSV export (respects filters + search)
  const periodConsolidated = useMemo(() => {
    const byEmp = new Map<string, { name: string; facial_ok: number; facial_fail: number; qr_ok: number; qr_fail: number; divergence: number; total: number }>();
    filteredAttempts.forEach(a => {
      const key = a.profile_id || 'unknown';
      const name = a.profiles?.full_name || '—';
      const row = byEmp.get(key) || { name, facial_ok: 0, facial_fail: 0, qr_ok: 0, qr_fail: 0, divergence: 0, total: 0 };
      row.total++;
      if (a.method_type === 'facial') a.success ? row.facial_ok++ : row.facial_fail++;
      else if (a.method_type === 'qrcode') a.success ? row.qr_ok++ : row.qr_fail++;
      else if (a.method_type === 'divergence') row.divergence++;
      byEmp.set(key, row);
    });
    return Array.from(byEmp.values()).sort((a, b) => b.total - a.total);
  }, [filteredAttempts]);

  // Server-side drilldown: paginate profiles table, aggregate only that page's attempts
  const loadDrilldown = async () => {
    if (!canSeeAll) return;
    setDrillLoading(true);
    try {
      const from = (drillPage - 1) * DRILL_PAGE_SIZE;
      const to = from + DRILL_PAGE_SIZE - 1;
      let pq = supabase
        .from('profiles')
        .select('id, full_name', { count: 'exact' })
        .eq('is_active', true)
        .order('full_name');
      if (profile?.company_id) pq = pq.eq('company_id', profile.company_id);
      if (drillSearch.trim()) pq = pq.ilike('full_name', `%${drillSearch.trim()}%`);
      const { data: profs, count, error } = await pq.range(from, to);
      if (error) throw error;
      setDrillTotal(count || 0);
      const ids = (profs || []).map(p => p.id);
      if (ids.length === 0) { setDrillRows([]); return; }

      const { data: atts, error: aerr } = await supabase
        .from('identification_validation_attempts')
        .select('profile_id, method_type, success')
        .in('profile_id', ids)
        .gte('created_at', `${fStart}T00:00:00`)
        .lte('created_at', `${fEnd}T23:59:59`);
      if (aerr) throw aerr;

      const agg = new Map<string, { profile_id: string; name: string; facial_ok: number; facial_fail: number; qr_ok: number; qr_fail: number; divergence: number; total: number }>();
      (profs || []).forEach(p => {
        agg.set(p.id, { profile_id: p.id, name: p.full_name, facial_ok: 0, facial_fail: 0, qr_ok: 0, qr_fail: 0, divergence: 0, total: 0 });
      });
      (atts || []).forEach((a: any) => {
        const r = agg.get(a.profile_id);
        if (!r) return;
        r.total++;
        if (a.method_type === 'facial') a.success ? r.facial_ok++ : r.facial_fail++;
        else if (a.method_type === 'qrcode') a.success ? r.qr_ok++ : r.qr_fail++;
        else if (a.method_type === 'divergence') r.divergence++;
      });
      setDrillRows(Array.from(agg.values()));
    } catch (e: any) {
      toast.error('Falha ao carregar detalhamento: ' + (e?.message || 'erro'));
      setDrillRows([]);
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    if (showDrilldown) loadDrilldown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDrilldown, drillPage, drillSearch, fStart, fEnd]);

  useEffect(() => { setDrillPage(1); }, [drillSearch, fStart, fEnd]);

  const totalDrillPages = Math.max(1, Math.ceil(drillTotal / DRILL_PAGE_SIZE));

  const monthly = useMemo(() => {
    const ok = filteredAttempts.filter(a => a.success).length;
    return { total: filteredAttempts.length, ok, fail: filteredAttempts.length - ok };
  }, [filteredAttempts]);
  


  // Fetch every row that matches current filters (respects server-side filters + search)
  const fetchAllFiltered = async (): Promise<Attempt[]> => {
    const { data, error } = await buildBaseQuery().limit(5000);
    if (error) throw error;
    return (data as unknown as Attempt[]) || [];
  };

  const exportCsv = async () => {
    try {
      const all = await fetchAllFiltered();
      if (all.length === 0) { toast.info('Nada para exportar'); return; }
      const header = ['Data/Hora', 'Funcionário', 'Matrícula', 'Método', 'Resultado', 'Confiança', 'Motivo', 'profile_id (device)', 'company_id (device)', 'timezone (device)', 'user-agent'];
      const rows = all.map(a => {
        const parts = (a.user_agent || '').split('|').map(s => s.trim());
        const rawUa = parts[0] || '';
        const meta: Record<string, string> = {};
        parts.slice(1).forEach(p => {
          const [k, ...v] = p.split('=');
          if (k && v.length) meta[k.trim()] = v.join('=').trim();
        });
        return [
          format(parseISO(a.created_at), 'dd/MM/yyyy HH:mm:ss'),
          a.profiles?.full_name || '-',
          a.profiles?.registration_number || '-',
          a.method_type === 'facial' ? 'Facial' : a.method_type === 'qrcode' ? 'QR Code' : a.method_type,
          a.success ? 'Aprovado' : 'Reprovado',
          a.confidence != null ? `${a.confidence}%` : '-',
          (a.reason || '').replace(/[\r\n;]/g, ' '),
          meta.profile_id || a.profile_id || '-',
          meta.company_id || a.company_id || '-',
          meta.tz || '-',
          rawUa.replace(/[\r\n;]/g, ' ').slice(0, 120),
        ];
      });
      const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_validacoes_${fStart}_a_${fEnd}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`CSV exportado (${all.length} registro(s))`);
    } catch (e: any) {
      toast.error('Falha ao exportar CSV: ' + (e?.message || 'erro'));
    }
  };

  const exportPdf = async () => {
    try {
      const all = await fetchAllFiltered();
      if (all.length === 0) { toast.info('Nada para exportar'); return; }
      const head = [['Data/Hora', 'Usuário', 'Método', 'Resultado', 'Motivo']];
      const body = all.map(a => [
        format(parseISO(a.created_at), 'dd/MM/yy HH:mm:ss'),
        a.profiles?.full_name || '-',
        a.method_type === 'facial' ? 'Facial' : a.method_type === 'qrcode' ? 'QR Code' : a.method_type,
        a.success ? 'Aprovado' : 'Reprovado',
        (a.reason || (a.success ? 'OK' : '-')).slice(0, 80),
      ]);
      const okA = all.filter(a => a.success).length;
      const doc = await generateStandardPDF(
        {
          title: 'Auditoria de Validações',
          subtitle: canSeeAll ? 'Tentativas de validação da empresa' : 'Minhas tentativas de validação',
          period: { start: format(parseISO(fStart), 'dd/MM/yyyy'), end: format(parseISO(fEnd), 'dd/MM/yyyy') },
          orientation: 'landscape',
        },
        { head, body, footer: [[`Total: ${all.length}`, `Aprovadas: ${okA}`, `Reprovadas: ${all.length - okA}`, '', '']] }
      );
      addFooter(doc);
      doc.save(`auditoria_validacoes_${fStart}_a_${fEnd}.pdf`);
      toast.success('PDF exportado');
    } catch (e: any) {
      toast.error('Falha ao gerar PDF: ' + (e?.message || 'erro'));
    }
  };

  const exportMonthlyCsv = () => {
    if (periodConsolidated.length === 0) {
      toast.info('Nada para exportar no período');
      return;
    }
    const header = ['Funcionário', 'Facial Aprov.', 'Facial Reprov.', 'QR Aprov.', 'QR Reprov.', 'Bloqueios Divergência', 'Total'];
    const rows = periodConsolidated.map(r => [r.name, r.facial_ok, r.facial_fail, r.qr_ok, r.qr_fail, r.divergence, r.total]);
    const totals = periodConsolidated.reduce((acc, r) => ({
      fok: acc.fok + r.facial_ok, ffail: acc.ffail + r.facial_fail,
      qok: acc.qok + r.qr_ok, qfail: acc.qfail + r.qr_fail,
      div: acc.div + r.divergence, tot: acc.tot + r.total,
    }), { fok: 0, ffail: 0, qok: 0, qfail: 0, div: 0, tot: 0 });
    rows.push(['TOTAL', totals.fok, totals.ffail, totals.qok, totals.qfail, totals.div, totals.tot]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consolidado_${fStart}_a_${fEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Consolidado CSV exportado');
  };

  // Log evidence download for traceability
  const logDownload = async (payload: {
    type: 'single_pdf' | 'zip_bundle';
    attemptId?: string;
    attemptIds?: string[];
    filename: string;
  }) => {
    try {
      await supabase.from('evidence_download_log').insert({
        user_id: user?.id,
        attempt_id: payload.attemptId ?? null,
        attempt_ids: payload.attemptIds ?? null,
        download_type: payload.type,
        filename: payload.filename,
        user_agent: navigator.userAgent,
      });
    } catch {/* non-blocking */}
  };

  // Compute expected values (from server-side attempt row) vs sent (device_info meta) and
  // return the list of fields that diverged.
  const computeDivergence = (a: Attempt, meta: Record<string, string>) => {
    const expected = {
      profile_id: a.profile_id || '—',
      company_id: a.company_id || '—',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '—',
    };
    const sent = {
      profile_id: meta.profile_id || '—',
      company_id: meta.company_id || '—',
      timezone: meta.tz || '—',
    };
    const divergent: Array<'profile_id' | 'company_id' | 'timezone'> = [];
    (Object.keys(expected) as Array<'profile_id' | 'company_id' | 'timezone'>).forEach(k => {
      if (expected[k] !== '—' && sent[k] !== '—' && expected[k] !== sent[k]) divergent.push(k);
    });
    return { expected, sent, divergent };
  };

  // Build evidence PDF for a single attempt and either save it or return the underlying jsPDF
  const buildEvidenceDoc = async (
    a: Attempt,
    meta: Record<string, string>,
    rawUa: string,
    justification?: string,
    blockContext?: string,
  ) => {
    const doc = await createA4PDF({
      title: 'Pacote de Evidências — Bloqueio por Divergência',
      subtitle: `Tentativa #${a.id.slice(0, 8)}`,
    });
    const jsdoc: any = doc;
    let y = getContentStartY(doc);
    const line = (label: string, value: string) => {
      jsdoc.setFont('helvetica', 'bold'); jsdoc.setFontSize(10);
      jsdoc.text(label, 14, y);
      jsdoc.setFont('helvetica', 'normal');
      const lines = jsdoc.splitTextToSize(value || '—', 170);
      jsdoc.text(lines, 55, y);
      y += Math.max(6, lines.length * 5);
    };
    line('ID da tentativa:', a.id);
    line('Data/Hora:', format(parseISO(a.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR }));
    line('Funcionário:', a.profiles?.full_name || '—');
    line('Matrícula:', a.profiles?.registration_number || '—');
    line('Método:', a.method_type);
    line('Resultado:', a.success ? 'Justificado / Confirmado' : 'Bloqueado');

    y += 3;
    jsdoc.setDrawColor(200); jsdoc.line(14, y, 196, y); y += 5;
    jsdoc.setFont('helvetica', 'bold'); jsdoc.setFontSize(11);
    jsdoc.text('Comparativo esperado × enviado', 14, y); y += 6;

    const { expected, sent, divergent } = computeDivergence(a, meta);
    const autoTable = (await import('jspdf-autotable')).default;
    const rows: any[] = (['profile_id', 'company_id', 'timezone'] as const).map(k => {
      const diff = divergent.includes(k);
      return [
        { content: k, styles: { fontStyle: diff ? 'bold' : 'normal' } },
        { content: expected[k], styles: { fontStyle: diff ? 'bold' : 'normal' } },
        { content: sent[k], styles: { fontStyle: diff ? 'bold' : 'normal', textColor: diff ? [180, 30, 30] : [0, 0, 0], fillColor: diff ? [254, 226, 226] : undefined } },
        { content: diff ? '⚠ Divergente' : 'OK', styles: { textColor: diff ? [180, 30, 30] : [16, 130, 90], fontStyle: 'bold' } },
      ];
    });
    autoTable(jsdoc, {
      startY: y,
      head: [['Campo', 'Esperado', 'Enviado', 'Status']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });
    y = (jsdoc.lastAutoTable?.finalY || y) + 6;

    jsdoc.setFont('helvetica', 'bold'); jsdoc.setFontSize(10);
    jsdoc.text(
      divergent.length
        ? `Campo(s) que causaram o bloqueio: ${divergent.join(', ')}`
        : 'Nenhum campo divergente identificado nos metadados enviados.',
      14, y,
    );
    y += 8;

    jsdoc.setDrawColor(200); jsdoc.line(14, y, 196, y); y += 5;
    jsdoc.setFont('helvetica', 'bold'); jsdoc.setFontSize(11);
    jsdoc.text('device_info (bruto)', 14, y); y += 6;
    line('profile_id:', meta.profile_id || a.profile_id || '—');
    line('company_id:', meta.company_id || a.company_id || '—');
    line('timezone:', meta.tz || '—');
    line('user-agent:', rawUa || '—');

    y += 3;
    jsdoc.setDrawColor(200); jsdoc.line(14, y, 196, y); y += 5;
    jsdoc.setFont('helvetica', 'bold'); jsdoc.setFontSize(11);
    jsdoc.text('Contexto do bloqueio', 14, y); y += 6;
    line('Motivo/Política:', a.reason || '—');
    if (blockContext) line('Detalhes:', blockContext);
    if (justification) {
      y += 2;
      jsdoc.setFont('helvetica', 'bold'); jsdoc.setFontSize(11);
      jsdoc.text('Justificativa do usuário', 14, y); y += 6;
      const lines = jsdoc.splitTextToSize(justification, 180);
      jsdoc.setFont('helvetica', 'normal'); jsdoc.setFontSize(10);
      jsdoc.text(lines, 14, y);
    }
    addFooter(doc);
    return doc;
  };

  const exportEvidencePdf = async (
    a: Attempt,
    meta: Record<string, string>,
    rawUa: string,
    justification?: string,
    blockContext?: string,
  ) => {
    try {
      const doc = await buildEvidenceDoc(a, meta, rawUa, justification, blockContext);
      const filename = `evidencia_${a.id.slice(0, 8)}_${format(parseISO(a.created_at), 'yyyyMMdd_HHmmss')}.pdf`;
      doc.save(filename);
      await logDownload({ type: 'single_pdf', attemptId: a.id, filename });
      toast.success('Pacote de evidências gerado');
    } catch (e: any) {
      toast.error('Falha ao gerar evidência: ' + (e?.message || 'erro'));
    }
  };

  // Bundle: build one evidence PDF per divergence attempt currently matching filters, zip them.
  const exportEvidenceZip = async () => {
    try {
      toast.info('Preparando pacote ZIP...');
      const all = await fetchAllFiltered();
      const divs = all.filter(x => x.method_type === 'divergence');
      if (divs.length === 0) { toast.info('Nenhuma tentativa bloqueada por divergência nos filtros atuais'); return; }
      const zip = new JSZip();
      for (const a of divs) {
        const parts = (a.user_agent || '').split('|').map(s => s.trim());
        const rawUa = parts[0] || '';
        const meta: Record<string, string> = {};
        parts.slice(1).forEach(p => {
          const [k, ...v] = p.split('=');
          if (k && v.length) meta[k.trim()] = v.join('=').trim();
        });
        const reason = a.reason || '';
        const justMatch = reason.match(/\[JUSTIFICATIVA\]\s*([^—]+)/);
        const blockMatch = reason.match(/\[BLOQUEIO\]\s*(.+)/);
        const doc = await buildEvidenceDoc(a, meta, rawUa, justMatch?.[1]?.trim(), blockMatch?.[1]?.trim());
        const buf = doc.output('arraybuffer');
        zip.file(`evidencia_${a.id.slice(0, 8)}_${format(parseISO(a.created_at), 'yyyyMMdd_HHmmss')}.pdf`, buf);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const filename = `evidencias_${fStart}_a_${fEnd}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      await logDownload({ type: 'zip_bundle', attemptIds: divs.map(d => d.id), filename });
      toast.success(`ZIP gerado com ${divs.length} evidência(s)`);
    } catch (e: any) {
      toast.error('Falha ao gerar ZIP: ' + (e?.message || 'erro'));
    }
  };


  const generateMonthlyConsolidated = async () => {
    try {
      const start = parseISO(`${fStart}T00:00:00`);
      const end = parseISO(`${fEnd}T23:59:59`);
      let recordsQ = supabase
        .from('time_records')
        .select('recorded_at, record_type, profile_id, profiles:profile_id(full_name)')
        .gte('recorded_at', start.toISOString())
        .lte('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: true })
        .limit(2000);
      if (canSeeAll && fEmployee !== 'all') recordsQ = recordsQ.eq('profile_id', fEmployee);
      const { data: recs, error } = await recordsQ;
      if (error) throw error;

      const inRange = attempts;
      const okA = inRange.filter(a => a.success).length;
      const facialA = inRange.filter(a => a.method_type === 'facial').length;
      const qrA = inRange.filter(a => a.method_type === 'qrcode').length;
      const divA = inRange.filter(a => a.method_type === 'divergence').length;

      const typeLabel: Record<string, string> = {
        entry: 'Entrada', break_start: 'Início Interv.', break_end: 'Fim Interv.', exit: 'Saída',
      };
      const recBody = (recs || []).slice(0, 400).map((r: any) => [
        format(parseISO(r.recorded_at), 'dd/MM HH:mm'),
        r.profiles?.full_name || '-',
        typeLabel[r.record_type] || r.record_type,
      ]);

      const empFilterLabel = canSeeAll && fEmployee !== 'all'
        ? (employees.find(e => e.id === fEmployee)?.full_name || fEmployee)
        : 'Todos os funcionários';

      const doc = await generateStandardPDF(
        {
          title: 'Relatório Consolidado',
          subtitle: `Marcações de ponto e validações — ${empFilterLabel}`,
          period: { start: format(start, 'dd/MM/yyyy'), end: format(end, 'dd/MM/yyyy') },
          orientation: 'portrait',
        },
        {
          head: [['Resumo', 'Valor']],
          body: [
            ['Marcações de ponto', String(recs?.length || 0)],
            ['Tentativas de validação', String(inRange.length)],
            ['Validações aprovadas', String(okA)],
            ['Validações reprovadas', String(inRange.length - okA)],
            ['Método facial', String(facialA)],
            ['Método QR Code', String(qrA)],
            ['Bloqueios por divergência', String(divA)],
            ['Taxa de sucesso', inRange.length ? `${Math.round((okA / inRange.length) * 100)}%` : '-'],
          ],
        },
        (doc, y) => {
          const jsdoc: any = doc;
          jsdoc.setFontSize(10);
          jsdoc.setFont('helvetica', 'bold');
          jsdoc.text(`Filtros ativos: ${empFilterLabel}`, 14, y);
          return y + 6;
        }
      );

      const jsdoc: any = doc;
      // Per-employee table
      jsdoc.addPage();
      jsdoc.setFontSize(12);
      jsdoc.setFont('helvetica', 'bold');
      jsdoc.text('Consolidado por funcionário', 14, 20);
      const autoTable = (await import('jspdf-autotable')).default;
      autoTable(jsdoc, {
        startY: 25,
        head: [['Funcionário', 'Facial ✓', 'Facial ✗', 'QR ✓', 'QR ✗', 'Divergência', 'Total']],
        body: periodConsolidated.map(r => [r.name, r.facial_ok, r.facial_fail, r.qr_ok, r.qr_fail, r.divergence, r.total]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        margin: { left: 14, right: 14 },
      });

      // Records table on a new page
      jsdoc.addPage();
      jsdoc.setFontSize(12);
      jsdoc.setFont('helvetica', 'bold');
      jsdoc.text('Marcações de Ponto (até 400 primeiras)', 14, 20);
      autoTable(jsdoc, {
        startY: 25,
        head: [['Data/Hora', 'Funcionário', 'Tipo']],
        body: recBody,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        margin: { left: 14, right: 14 },
      });

      addFooter(doc);
      doc.save(`consolidado_${fStart}_a_${fEnd}.pdf`);
      toast.success('Relatório consolidado gerado');
    } catch (e: any) {
      toast.error('Falha ao gerar relatório: ' + (e?.message || 'erro'));
    }
  };




  const methodIcon = (m: string) =>
    m === 'facial' ? <Camera className="h-3 w-3" /> : m === 'qrcode' ? <QrCode className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoria de Validações</h1>
          <p className="text-muted-foreground">
            {canSeeAll
              ? 'Todas as tentativas de validação (facial e QR Code) da empresa.'
              : 'Suas tentativas de validação de ponto (facial e QR Code).'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={exportMonthlyCsv}>
            <FileBarChart className="h-4 w-4 mr-2" />
            Consolidado CSV
          </Button>
          <Button onClick={generateMonthlyConsolidated}>
            <FileBarChart className="h-4 w-4 mr-2" />
            Consolidado PDF
          </Button>

        </div>

      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardDescription>Total no período</CardDescription><CardTitle className="text-2xl">{stats.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Aprovadas</CardDescription><CardTitle className="text-2xl text-emerald-600">{stats.ok}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Reprovadas</CardDescription><CardTitle className="text-2xl text-destructive">{stats.fail}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Taxa de sucesso</CardDescription><CardTitle className="text-2xl">{stats.rate}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Facial / QR</CardDescription><CardTitle className="text-2xl">{stats.facial}/{stats.qr}</CardTitle></CardHeader></Card>
      </div>

      {/* Monthly summary — clickable */}
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setShowDrilldown(true)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowDrilldown(true)}
        className="cursor-pointer transition hover:border-primary/40 hover:shadow-sm"
      >
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Consolidado do período ({format(parseISO(fStart), 'dd/MM/yyyy')} — {format(parseISO(fEnd), 'dd/MM/yyyy')})</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">Abrir detalhamento <ChevronRight className="h-3 w-3" /></span>
          </CardTitle>
          <CardDescription>Clique para ver detalhamento por funcionário e por método (Facial / QR / Divergência).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-muted-foreground">Tentativas no período</p><p className="text-xl font-semibold">{monthly.total}</p></div>
          <div><p className="text-muted-foreground">Aprovadas</p><p className="text-xl font-semibold text-emerald-600">{monthly.ok}</p></div>
          <div><p className="text-muted-foreground">Reprovadas</p><p className="text-xl font-semibold text-destructive">{monthly.fail}</p></div>
        </CardContent>
      </Card>


      {/* Daily chart */}
      {canSeeAll && dailySeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validações por dia</CardTitle>
            <CardDescription>Quantidade por método (facial / QR) e resultado (aprovada / reprovada).</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="facial_ok" name="Facial aprovada" stackId="facial" fill="#10b981" />
                <Bar dataKey="facial_fail" name="Facial reprovada" stackId="facial" fill="#ef4444" />
                <Bar dataKey="qr_ok" name="QR aprovada" stackId="qr" fill="#0ea5e9" />
                <Bar dataKey="qr_fail" name="QR reprovada" stackId="qr" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Drilldown dialog */}
      <Dialog open={showDrilldown} onOpenChange={setShowDrilldown}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhamento — {format(parseISO(fStart), 'dd/MM/yyyy')} a {format(parseISO(fEnd), 'dd/MM/yyyy')}</DialogTitle>
            <DialogDescription>Validações por funcionário, separadas por método (Facial / QR / Divergência).</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={drillSearch}
                onChange={e => setDrillSearch(e.target.value)}
                placeholder="Buscar funcionário..."
                className="pl-8"
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {drillTotal} funcionário(s)
            </span>
          </div>

          {drillLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : drillRows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Nenhum resultado.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-center">Facial ✓</TableHead>
                    <TableHead className="text-center">Facial ✗</TableHead>
                    <TableHead className="text-center">QR ✓</TableHead>
                    <TableHead className="text-center">QR ✗</TableHead>
                    <TableHead className="text-center">Diverg.</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillRows.map((r) => (
                    <TableRow key={r.profile_id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-center text-emerald-600">{r.facial_ok}</TableCell>
                      <TableCell className="text-center text-destructive">{r.facial_fail}</TableCell>
                      <TableCell className="text-center text-emerald-600">{r.qr_ok}</TableCell>
                      <TableCell className="text-center text-destructive">{r.qr_fail}</TableCell>
                      <TableCell className="text-center text-amber-600">{r.divergence}</TableCell>
                      <TableCell className="text-center font-semibold">{r.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-3">
                <span className="text-xs text-muted-foreground">
                  Página {drillPage} de {totalDrillPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={drillPage <= 1} onClick={() => setDrillPage(p => Math.max(1, p - 1))}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={drillPage >= totalDrillPages} onClick={() => setDrillPage(p => Math.min(totalDrillPages, p + 1))}>
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>


      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros</CardTitle>
          <CardDescription>Filtre por período, método, status, dispositivo (device_info) ou busque texto livre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label>De</Label>
              <Input type="date" value={fStart} onChange={e => setFStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={fMethod} onValueChange={setFMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="facial">Facial</SelectItem>
                  <SelectItem value="qrcode">QR Code</SelectItem>
                  <SelectItem value="divergence">Bloqueio por divergência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Aprovadas</SelectItem>
                  <SelectItem value="fail">Reprovadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canSeeAll && (
              <div className="space-y-1">
                <Label>Funcionário</Label>
                <Select value={fEmployee} onValueChange={setFEmployee}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Device_info + free-text search */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs">device_info · employee_id</Label>
              <Input value={fDevEmployeeId} onChange={e => setFDevEmployeeId(e.target.value)} placeholder="ex.: uuid do perfil" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">device_info · company_id</Label>
              <Input value={fDevCompanyId} onChange={e => setFDevCompanyId(e.target.value)} placeholder="ex.: uuid da empresa" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">device_info · timezone</Label>
              <Input value={fDevTimezone} onChange={e => setFDevTimezone(e.target.value)} placeholder="ex.: America/Sao_Paulo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Busca livre</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Nome, motivo, user-agent..." className="pl-8" />
              </div>
            </div>
          </div>
          {(fDevEmployeeId || fDevCompanyId || fDevTimezone || fSearch) && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setFDevEmployeeId(''); setFDevCompanyId(''); setFDevTimezone(''); setFSearch(''); }}>
                Limpar filtros de dispositivo/busca
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tentativas</CardTitle>
          <CardDescription>{filteredAttempts.length} de {attempts.length} registro(s) — máx. 1000 por consulta.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : filteredAttempts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Nenhuma tentativa encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    {canSeeAll && <TableHead>Funcionário</TableHead>}
                    <TableHead>Método</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead>Motivo / Política</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttempts.map(a => {
                    const isDiv = a.method_type === 'divergence';
                    const methodLabel = a.method_type === 'facial' ? 'Facial'
                      : a.method_type === 'qrcode' ? 'QR Code'
                      : isDiv ? 'Divergência' : a.method_type;
                    const ua = a.user_agent || '';
                    const parts = ua.split('|').map(s => s.trim());
                    const rawUa = parts[0] || '';
                    const meta: Record<string, string> = {};
                    parts.slice(1).forEach(p => {
                      const [k, ...v] = p.split('=');
                      if (k && v.length) meta[k.trim()] = v.join('=').trim();
                    });
                    const reason = a.reason || '';
                    const justMatch = reason.match(/\[JUSTIFICATIVA\]\s*([^—]+)/);
                    const blockMatch = reason.match(/\[BLOQUEIO\]\s*(.+)/);
                    const isFocused = focusedAttemptId === a.id;
                    return (
                      <TableRow
                        key={a.id}
                        ref={(el) => { rowRefs.current[a.id] = el; }}
                        className={`${isDiv ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''} ${isFocused ? 'ring-2 ring-amber-500' : ''}`}
                      >
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {format(parseISO(a.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </TableCell>
                        {canSeeAll && (
                          <TableCell className="text-sm">
                            {a.profiles?.full_name || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={isDiv ? 'secondary' : 'outline'} className="flex w-fit items-center gap-1">
                            {isDiv ? <AlertTriangle className="h-3 w-3 text-amber-600" /> : methodIcon(a.method_type)}
                            {methodLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.success ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 flex w-fit items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> {isDiv ? 'Justificado' : 'Aprovado'}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="flex w-fit items-center gap-1">
                              <XCircle className="h-3 w-3" /> {isDiv ? 'Bloqueado' : 'Reprovado'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{a.confidence != null ? `${a.confidence}%` : '-'}</TableCell>
                        <TableCell className="text-sm max-w-[420px]">
                          <span className={a.success ? 'text-muted-foreground' : 'text-destructive'}>
                            {reason || (a.success ? 'OK' : 'Sem detalhes')}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Detalhes do dispositivo">
                                  <Info className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-96 text-xs space-y-2">
                                <div>
                                  <p className="font-semibold mb-1">Dispositivo (device_info)</p>
                                  <div className="rounded border p-2 bg-muted/40 space-y-0.5 font-mono">
                                    <div><span className="text-muted-foreground">profile_id:</span> {meta.profile_id || a.profile_id || '—'}</div>
                                    <div><span className="text-muted-foreground">company_id:</span> {meta.company_id || a.company_id || '—'}</div>
                                    <div><span className="text-muted-foreground">timezone:</span> {meta.tz || '—'}</div>
                                    <div className="pt-1 break-all"><span className="text-muted-foreground">user-agent:</span> {rawUa || '—'}</div>
                                  </div>
                                </div>
                                {(justMatch || blockMatch) && (
                                  <div>
                                    <p className="font-semibold mb-1">
                                      {justMatch ? 'Justificativa anexada' : 'Contexto do bloqueio'}
                                    </p>
                                    <div className="rounded border p-2 bg-amber-50 dark:bg-amber-950/20">
                                      {(justMatch?.[1] || blockMatch?.[1] || '').trim()}
                                    </div>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                            {isDiv && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Baixar pacote de evidências (PDF)"
                                onClick={() => exportEvidencePdf(a, meta, rawUa, justMatch?.[1]?.trim(), blockMatch?.[1]?.trim())}
                              >
                                <FileText className="h-4 w-4 text-amber-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
