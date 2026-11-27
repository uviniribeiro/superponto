import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Barcode, Download, Loader2, QrCode, RefreshCw, ScanFace } from 'lucide-react';

interface Props {
  profileId: string;
  companyId: string;
  employeeName: string;
  photoUrl?: string | null;
}

interface Method { id: string; method_type: string; identifier: string | null; is_active: boolean; expires_at: string | null }

function randomToken(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Geração de credenciais do funcionário direto no cadastro:
 * QR Code, código de barras e habilitação do reconhecimento facial.
 */
export function EmployeeCredentialCodes({ profileId, companyId, employeeName, photoUrl }: Props) {
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const qrCanvas = useRef<HTMLCanvasElement | null>(null);
  const barcodeSvg = useRef<SVGSVGElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employee_identification_methods')
      .select('id, method_type, identifier, is_active, expires_at')
      .eq('profile_id', profileId);
    setMethods((data as Method[]) || []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const qr = methods.find(m => m.method_type === 'qrcode' && m.is_active);
  const barcode = methods.find(m => m.method_type === 'barcode' && m.is_active);
  const facial = methods.find(m => m.method_type === 'facial' && m.is_active);

  useEffect(() => {
    if (qr?.identifier && qrCanvas.current) {
      QRCode.toCanvas(qrCanvas.current, qr.identifier, { width: 200, margin: 1 }).catch(() => undefined);
    }
  }, [qr?.identifier]);

  useEffect(() => {
    if (barcode?.identifier && barcodeSvg.current) {
      try {
        JsBarcode(barcodeSvg.current, barcode.identifier, { format: 'CODE128', height: 60, fontSize: 14, margin: 4 });
      } catch { /* identificador incompatível com o formato */ }
    }
  }, [barcode?.identifier]);

  const generate = async (type: 'qrcode' | 'barcode') => {
    setWorking(type);
    try {
      // QR Code: o banco substitui o identificador por um hash SHA-256 exclusivo do cadastro (SPQR1.<hash>).
      const identifier = type === 'qrcode' ? `PM-${randomToken(16)}` : randomToken(12);
      const expires_at = type === 'qrcode' ? new Date(Date.now() + 365 * 86_400_000).toISOString() : null;
      const current = methods.find(m => m.method_type === type);
      const { error } = current
        ? await supabase.from('employee_identification_methods')
            .update({ identifier, is_active: true, expires_at }).eq('id', current.id)
        : await supabase.from('employee_identification_methods').insert({
            profile_id: profileId, company_id: companyId, method_type: type, identifier, is_active: true, expires_at,
          });
      if (error) throw error;
      toast.success(type === 'qrcode' ? 'QR Code gerado.' : 'Código de barras gerado.');
      await load();
    } catch {
      toast.error('Não foi possível gerar o código agora.');
    } finally {
      setWorking(null);
    }
  };

  const enableFacial = async () => {
    if (!photoUrl) {
      toast.error('Envie a foto do funcionário antes de habilitar o reconhecimento facial.');
      return;
    }
    setWorking('facial');
    try {
      const { error } = await supabase.from('employee_identification_methods').insert({
        profile_id: profileId,
        company_id: companyId,
        method_type: 'facial',
        identifier: `FACE-${profileId.slice(0, 8)}`,
        is_active: true,
      });
      if (error) throw error;
      await supabase.from('profiles').update({ face_enrolled_at: new Date().toISOString() }).eq('id', profileId);
      toast.success('Reconhecimento facial habilitado a partir da foto do funcionário.');
      await load();
    } catch {
      toast.error('Não foi possível habilitar o reconhecimento facial.');
    } finally {
      setWorking(null);
    }
  };

  const downloadQr = async () => {
    if (!qr?.identifier) return;
    const url = await QRCode.toDataURL(qr.identifier, { width: 600, margin: 2 });
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode_${employeeName.replace(/\s+/g, '_').toLowerCase()}.png`;
    a.click();
  };

  const downloadBarcode = () => {
    if (!barcodeSvg.current) return;
    const svg = new XMLSerializer().serializeToString(barcodeSvg.current);
    const a = document.createElement('a');
    a.href = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    a.download = `codigo_barras_${employeeName.replace(/\s+/g, '_').toLowerCase()}.svg`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credenciais de registro de ponto</CardTitle>
        <CardDescription>
          Gere o QR Code ou o código de barras do crachá e habilite o reconhecimento facial usando a foto do funcionário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            {/* QR Code */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-lg border bg-card p-2">
                {qr?.identifier ? <canvas ref={qrCanvas} /> : <div className="flex h-[200px] w-[200px] items-center justify-center text-xs text-muted-foreground">Sem QR Code</div>}
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-2 font-medium"><QrCode className="h-4 w-4" /> QR Code</p>
                {qr?.identifier && <p className="max-w-[260px] break-all font-mono text-[10px] text-muted-foreground" title="Hash exclusivo do cadastro">{qr.identifier}</p>}
                <p className="max-w-[260px] text-xs text-muted-foreground">No terminal, depois do QR o funcionário olha para a câmera: se o rosto não for o do cadastro, o registro é recusado.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => generate('qrcode')} disabled={working === 'qrcode'}>
                    {working === 'qrcode' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {qr ? 'Gerar novo (invalida o atual)' : 'Gerar QR Code'}
                  </Button>
                  {qr && <Button size="sm" variant="ghost" onClick={downloadQr}><Download className="mr-2 h-4 w-4" /> Baixar</Button>}
                </div>
              </div>
            </div>

            {/* Código de barras */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-lg border bg-card p-2">
                {barcode?.identifier ? <svg ref={barcodeSvg} /> : <div className="flex h-[80px] w-[200px] items-center justify-center text-xs text-muted-foreground">Sem código de barras</div>}
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-2 font-medium"><Barcode className="h-4 w-4" /> Código de barras (crachá)</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => generate('barcode')} disabled={working === 'barcode'}>
                    {working === 'barcode' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {barcode ? 'Gerar novo' : 'Gerar código'}
                  </Button>
                  {barcode && <Button size="sm" variant="ghost" onClick={downloadBarcode}><Download className="mr-2 h-4 w-4" /> Baixar</Button>}
                </div>
              </div>
            </div>

            {/* Facial */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {photoUrl
                  ? <img src={photoUrl} alt={`Foto de ${employeeName}`} className="h-14 w-14 rounded-full object-cover" loading="lazy" />
                  : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">Sem foto</div>}
                <div>
                  <p className="flex items-center gap-2 font-medium"><ScanFace className="h-4 w-4" /> Reconhecimento facial</p>
                  <p className="text-xs text-muted-foreground">
                    {facial ? 'Habilitado — o terminal reconhece o funcionário pela foto cadastrada.' : 'A foto do funcionário é usada como referência no terminal.'}
                  </p>
                </div>
              </div>
              {facial
                ? <Badge variant="secondary">Ativo</Badge>
                : <Button size="sm" onClick={enableFacial} disabled={working === 'facial'}>
                    {working === 'facial' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
                    Habilitar
                  </Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
