import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  validateCPF,
  validatePIS,
  validateEmail,
  validatePhone,
  validateCEP,
  validateRG,
  validateCTPS,
  validateTime,
  validateRequiredText,
  formatCPF,
  formatPIS,
  formatPhone,
  formatCEP,
} from '@/lib/validators';

export type ValidationKind =
  | 'cpf'
  | 'pis'
  | 'email'
  | 'phone'
  | 'cep'
  | 'rg'
  | 'ctps'
  | 'time'
  | 'text';

interface ValidatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  kind: ValidationKind;
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (valid: boolean) => void;
  optional?: boolean;
  helper?: string;
}

function runValidation(kind: ValidationKind, value: string, label: string) {
  switch (kind) {
    case 'cpf':
      return validateCPF(value);
    case 'pis':
      return validatePIS(value);
    case 'email':
      return validateEmail(value);
    case 'phone':
      return validatePhone(value);
    case 'cep':
      return validateCEP(value);
    case 'rg':
      return validateRG(value);
    case 'ctps':
      return validateCTPS(value);
    case 'time':
      return validateTime(value);
    default:
      return validateRequiredText(value, label || 'o campo');
  }
}

function applyMask(kind: ValidationKind, value: string) {
  switch (kind) {
    case 'cpf': {
      const d = value.replace(/\D/g, '').slice(0, 11);
      return d.length === 11 ? formatCPF(d) : d;
    }
    case 'pis': {
      const d = value.replace(/\D/g, '').slice(0, 11);
      return d.length === 11 ? formatPIS(d) : d;
    }
    case 'phone':
      return formatPhone(value);
    case 'cep': {
      const d = value.replace(/\D/g, '').slice(0, 8);
      return d.length === 8 ? formatCEP(d) : d;
    }
    default:
      return value;
  }
}

/**
 * Campo de formulário com validação e feedback padronizados
 * (causa do erro + como corrigir).
 */
export function ValidatedInput({
  label,
  kind,
  value,
  onChange,
  onValidityChange,
  optional = false,
  helper,
  className,
  id,
  ...rest
}: ValidatedInputProps) {
  const fieldId = id || `field-${kind}-${label?.replace(/\s+/g, '-').toLowerCase()}`;

  const result = useMemo(() => {
    if (!value && optional) return { valid: true, message: '' };
    return runValidation(kind, value, label || '');
  }, [kind, value, optional, label]);

  React.useEffect(() => {
    onValidityChange?.(result.valid);
  }, [result.valid, onValidityChange]);

  const touched = value.length > 0;
  const showError = touched && !result.valid;
  const showSuccess = touched && result.valid;

  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={fieldId} className="text-sm">
          {label} {!optional && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Input
        id={fieldId}
        value={value}
        aria-invalid={showError}
        onChange={(e) => onChange(applyMask(kind, e.target.value))}
        className={cn(
          showError && 'border-destructive focus-visible:ring-destructive',
          showSuccess && 'border-primary/50',
          className,
        )}
        {...rest}
      />
      {showError && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{result.message}</span>
        </p>
      )}
      {!showError && showSuccess && result.message && (
        <p className="flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{result.message}</span>
        </p>
      )}
      {!touched && helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

export default ValidatedInput;
