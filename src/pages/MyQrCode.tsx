// Meu QR Code: o crachá digital do funcionário para o terminal. O conteúdo é um hash exclusivo do cadastro;
// no terminal, depois do QR, o rosto é conferido com a foto cadastrada.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, ScanFace } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MyQrCode() {
  const { profile } = useAuth();
  const [qr, setQr] = useState<{ identifier: string; expires_at: string | null } | null | undefined>(undefined);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('employee_identification_methods').select('identifier, expires_at, is_active')
      .eq('profile_id', profile.id).eq('method_type', 'qrcode').eq('is_active', true).maybeSingle()
      .then(({ data }) => setQr(data?.identifier ? { identifier: data.identifier, expires_at: data.expires_at } : null));
  }, [profile?.id]);

  useEffect(() => {
    if (qr?.identifier && canvas.current) QRCode.toCanvas(canvas.current, qr.identifier, { width: 280, margin: 2 }).catch(() => undefined);
  }, [qr?.identifier]);

  const download = async () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = await QRCode.toDataURL(qr.identifier, { width: 800, margin: 2 });
    a.download = 'meu_qrcode_ponto.png';
    a.click();
  };

  const expired = qr?.expires_at && new Date(qr.expires_at) <= new Date();

  return (
    <div className="space-y-6">
      <PageHeader title="Meu QR Code" description="Mostre no terminal de ponto e, em seguida, olhe para a câmera." icon={QrCode} />
      <Card className="mx-auto max-w-md rounded-3xl">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          {qr === undefined ? <p className="text-muted-foreground">Carregando…</p>
            : !qr ? <p className="text-muted-foreground">Você ainda não tem QR Code. Peça ao RH para gerar no seu cadastro.</p>
            : <>
                <div className="rounded-2xl border bg-white p-3"><canvas ref={canvas} /></div>
                <p className="font-semibold">{profile?.full_name}</p>
                {expired
                  ? <p className="text-sm text-destructive">QR Code expirado — peça um novo ao RH.</p>
                  : qr.expires_at && <p className="text-xs text-muted-foreground">Válido até {new Date(qr.expires_at).toLocaleDateString('pt-BR')}</p>}
                <p className="flex items-start gap-2 text-left text-xs text-muted-foreground"><ScanFace className="mt-0.5 h-4 w-4 shrink-0" />O QR Code é exclusivo seu. No terminal, o rosto é comparado com a foto do seu cadastro; se for outra pessoa, o registro é recusado.</p>
                <Button variant="outline" className="rounded-full" onClick={download}><Download className="mr-2 h-4 w-4" />Baixar imagem</Button>
              </>}
        </CardContent>
      </Card>
    </div>
  );
}
