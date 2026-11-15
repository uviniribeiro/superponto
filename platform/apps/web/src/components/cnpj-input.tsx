'use client';

import { isValidCnpj, maskCnpjInput } from '@superponto/br-docs';
import { useState } from 'react';
import { Input } from './ui';

/** Campo de CNPJ numérico ou alfanumérico (IN RFB 2.229/2024): máscara e validação dos DVs ao digitar. */
export function CnpjInput({ name, label = 'CNPJ', defaultValue = '', error, required }: { name: string; label?: string; defaultValue?: string; error?: string; required?: boolean }) {
  const [value, setValue] = useState(maskCnpjInput(defaultValue));
  const [touched, setTouched] = useState(false);
  const complete = value.replace(/[^0-9A-Z]/g, '').length === 14;
  const localError = touched && value && (!complete || !isValidCnpj(value)) ? 'CNPJ inválido: confira os caracteres e os 2 dígitos finais' : undefined;
  return (
    <Input
      label={label}
      name={name}
      value={value}
      onChange={(e) => setValue(maskCnpjInput(e.target.value))}
      onBlur={() => setTouched(true)}
      error={error ?? localError}
      hint="Aceita o novo CNPJ com letras, ex.: 12.ABC.345/01DE-35"
      placeholder="00.000.000/0000-00"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      required={required}
      className="font-mono tracking-wide"
    />
  );
}
