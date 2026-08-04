import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CnpjInput } from '@/components/shared/CnpjInput';

/** Dispara um change nativo compatível com React */
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CnpjInput', () => {
  it('mostra dica de formato quando vazio', () => {
    const { getByText } = render(<CnpjInput id="cnpj" value="" onChange={vi.fn()} />);
    expect(getByText(/alfanumérico/i)).toBeInTheDocument();
  });

  it('avisa quando o CNPJ está incompleto', () => {
    const { getByText } = render(<CnpjInput id="cnpj" value="11.444" onChange={vi.fn()} />);
    expect(getByText(/CNPJ incompleto/i)).toBeInTheDocument();
  });

  it('explica o erro de dígito verificador e oferece correção', () => {
    const onChange = vi.fn();
    const { getByText, getByRole } = render(
      <CnpjInput id="cnpj" value="11.444.777/0001-62" onChange={onChange} />
    );
    expect(getByText(/Dígito verificador não confere/i)).toBeInTheDocument();

    getByRole('button', { name: /11\.444\.777\/0001-61/ }).click();
    expect(onChange).toHaveBeenCalledWith('11.444.777/0001-61');
  });

  it('confirma CNPJ numérico válido', () => {
    const { getByText } = render(<CnpjInput id="cnpj" value="11.444.777/0001-61" onChange={vi.fn()} />);
    expect(getByText('CNPJ válido')).toBeInTheDocument();
  });

  it('confirma CNPJ alfanumérico válido', () => {
    const { getByText } = render(<CnpjInput id="cnpj" value="12.ABC.345/01DE-35" onChange={vi.fn()} />);
    expect(getByText('CNPJ alfanumérico válido')).toBeInTheDocument();
  });

  it('aceita digitação de letras (input alfanumérico)', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<CnpjInput id="cnpj" value="" onChange={onChange} />);
    typeInto(getByRole('textbox') as HTMLInputElement, '12abc34501de35');
    expect(onChange).toHaveBeenCalledWith('12.ABC.345/01DE-35');
  });
});
