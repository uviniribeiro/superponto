import * as React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { MaskedInput } from '@/components/ui/masked-input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCNPJFeedback } from '@/lib/validators';

interface CnpjInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  /** Exibe a dica de formato mesmo com o campo vazio */
  showHintWhenEmpty?: boolean;
}

/**
 * Campo de CNPJ com feedback visual detalhado:
 * indica exatamente o que está inválido e como corrigir (inclusive o DV esperado).
 */
export const CnpjInput = React.forwardRef<HTMLInputElement, CnpjInputProps>(
  ({ id, value, onChange, onBlur, disabled, className, showHintWhenEmpty = true }, ref) => {
    const feedback = getCNPJFeedback(value);

    return (
      <div className="space-y-1.5">
        <MaskedInput
          ref={ref}
          id={id}
          mask="cnpj"
          showValidation
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className={className}
          aria-invalid={feedback.status === 'invalid'}
          aria-describedby={id ? `${id}-feedback` : undefined}
        />

        <div id={id ? `${id}-feedback` : undefined} aria-live="polite" className="space-y-1">
          {feedback.status === 'valid' && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {feedback.message}
              {feedback.isAlphanumeric && (
                <Badge variant="secondary" className="ml-1 text-[10px]">Alfanumérico</Badge>
              )}
            </p>
          )}

          {(feedback.status === 'invalid' || feedback.status === 'incomplete') && (
            <div
              className={cn(
                'rounded-md border px-2.5 py-2 text-xs',
                feedback.status === 'invalid'
                  ? 'border-destructive/40 bg-destructive/5 text-destructive'
                  : 'border-muted-foreground/20 bg-muted/40 text-muted-foreground'
              )}
            >
              <p className="flex items-start gap-1.5 font-medium">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{feedback.message}</span>
              </p>
              {feedback.hint && (
                <p className="mt-1 pl-5 font-normal opacity-90">{feedback.hint}</p>
              )}
              {feedback.suggestion && (
                <button
                  type="button"
                  onClick={() => onChange(feedback.suggestion!)}
                  className="mt-1.5 ml-5 rounded border border-current/30 px-2 py-0.5 font-medium underline-offset-2 hover:underline"
                >
                  Usar {feedback.suggestion}
                </button>
              )}
            </div>
          )}

          {feedback.status === 'empty' && showHintWhenEmpty && feedback.hint && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {feedback.hint}
            </p>
          )}
        </div>
      </div>
    );
  }
);

CnpjInput.displayName = 'CnpjInput';
