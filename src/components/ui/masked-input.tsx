import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { 
  formatCPF, 
  formatCNPJ, 
  formatPIS, 
  formatPhone, 
  formatCEI,
  validateCPF,
  validateCNPJ,
  validatePIS 
} from "@/hooks/useDocumentMask";

export type MaskType = 'cpf' | 'cnpj' | 'pis' | 'phone' | 'cei' | 'cep';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: MaskType;
  value: string;
  onChange: (value: string) => void;
  showValidation?: boolean;
}

const formatCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, '').substring(0, 8);
  if (numbers.length <= 5) return numbers;
  return `${numbers.substring(0, 5)}-${numbers.substring(5)}`;
};

const maskFormatters: Record<MaskType, (value: string) => string> = {
  cpf: formatCPF,
  cnpj: formatCNPJ,
  pis: formatPIS,
  phone: formatPhone,
  cei: formatCEI,
  cep: formatCEP,
};

const maskValidators: Partial<Record<MaskType, (value: string) => boolean>> = {
  cpf: validateCPF,
  cnpj: validateCNPJ,
  pis: validatePIS,
};

const maskPlaceholders: Record<MaskType, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  pis: '000.00000.00-0',
  phone: '(00) 00000-0000',
  cei: '00.000.00000/00',
  cep: '00000-000',
};

const maskMaxLengths: Record<MaskType, number> = {
  cpf: 14,
  cnpj: 18,
  pis: 14,
  phone: 15,
  cei: 15,
  cep: 9,
};

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ className, mask, value, onChange, showValidation = false, ...props }, ref) => {
    const formatter = maskFormatters[mask];
    const validator = maskValidators[mask];
    const placeholder = props.placeholder || maskPlaceholders[mask];
    const maxLength = maskMaxLengths[mask];
    // CNPJ alfanumérico (Receita Federal 2026) aceita letras A-Z nas 12 primeiras posições
    const isAlphanumericMask = mask === 'cnpj';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatter(e.target.value);
      onChange(formatted);
    };

    const isValid = validator ? validator(value) : true;
    const stripped = isAlphanumericMask
      ? (value || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
      : (value || '').replace(/\D/g, '');
    const hasValue = stripped.length > 0;
    const isComplete = value.length === maxLength;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode={isAlphanumericMask ? 'text' : 'numeric'}
          autoCapitalize={isAlphanumericMask ? 'characters' : undefined}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            showValidation && hasValue && isComplete && (
              isValid 
                ? "border-success focus-visible:ring-success/30" 
                : "border-destructive focus-visible:ring-destructive/30"
            ),
            className
          )}
          {...props}
        />
        {showValidation && hasValue && isComplete && (
          <div className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium",
            isValid ? "text-success" : "text-destructive"
          )}>
            {isValid ? "✓" : "✗"}
          </div>
        )}
      </div>
    );
  }
);

MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
