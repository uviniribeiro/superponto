import { useState } from 'react';
import { AlertCircle, Wrench, Loader2, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { GENERIC_USER_MESSAGE, type ReportedError } from '@/lib/errorReporting';
import { toast } from 'sonner';

interface ErrorNoticeProps {
  error: ReportedError | null;
  onFixed?: () => void;
}

/**
 * Exibição padronizada de erros:
 * - usuário comum: "Ocorreu um erro"
 * - administrador: detalhe técnico + botão de correção automática
 */
export function ErrorNotice({ error, onFixed }: ErrorNoticeProps) {
  const { isAdmin } = useAuth();
  const [fixing, setFixing] = useState(false);
  const [open, setOpen] = useState(false);

  if (!error) return null;

  const runFix = async () => {
    if (!error.diagnosticId) return;
    setFixing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('system-autofix', {
        body: { diagnosticId: error.diagnosticId },
      });
      if (fnError) throw fnError;
      const result = data?.results?.[0];
      if (result?.ok) {
        toast.success(result.message || 'Erro corrigido automaticamente.');
        onFixed?.();
      } else {
        toast.error(result?.message || 'Não foi possível corrigir automaticamente.');
      }
    } catch (e) {
      toast.error('Falha ao executar a correção automática.');
    } finally {
      setFixing(false);
    }
  };

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Ocorreu um erro</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{error.userMessage || GENERIC_USER_MESSAGE}</p>

        {isAdmin && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                Detalhes técnicos (administrador)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-2 text-xs">
                {error.technicalDetail}
              </pre>
              {error.diagnosticId && (
                <Button size="sm" className="mt-2" onClick={runFix} disabled={fixing}>
                  {fixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                  Corrigir automaticamente
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </AlertDescription>
    </Alert>
  );
}
