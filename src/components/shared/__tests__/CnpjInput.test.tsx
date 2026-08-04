import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CnpjInput } from '@/components/shared/CnpjInput';

function Wrapper({ initial = '' }: { initial?: string }) {
  const [value, setValue] = (require('react') as typeof import('react')).useState(initial);
  return <CnpjInput id="cnpj" value={value} onChange={setValue} />;
}

describe('CnpjInput', () => {
  it('mostra dica de formato quando vazio', () => {
    render(<CnpjInput id="cnpj" value="" onChange={vi.fn()} />);
    expect(screen.getByText(/alfanumérico/i)).toBeInTheDocument();
  });

  it('avisa quando o CNPJ está incompleto', () => {
    render(<CnpjInput id="cnpj" value="11.444" onChange={vi.fn()} />);
    expect(screen.getByText(/CNPJ incompleto/i)).toBeInTheDocument();
  });

  it('explica o erro de dígito verificador e oferece correção', () => {
    const onChange = vi.fn();
    render(<CnpjInput id="cnpj" value="11.444.777/0001-62" onChange={onChange} />);
    expect(screen.getByText(/Dígito verificador não confere/i)).toBeInTheDocument();

    const fixButton = screen.getByRole('button', { name: /11\.444\.777\/0001-61/ });
    fireEvent.click(fixButton);
    expect(onChange).toHaveBeenCalledWith('11.444.777/0001-61');
  });

  it('confirma CNPJ numérico válido', () => {
    render(<CnpjInput id="cnpj" value="11.444.777/0001-61" onChange={vi.fn()} />);
    expect(screen.getByText('CNPJ válido')).toBeInTheDocument();
  });

  it('confirma CNPJ alfanumérico válido', () => {
    render(<CnpjInput id="cnpj" value="12.ABC.345/01DE-35" onChange={vi.fn()} />);
    expect(screen.getByText('CNPJ alfanumérico válido')).toBeInTheDocument();
  });

  it('aceita digitação de letras (input alfanumérico)', () => {
    const onChange = vi.fn();
    render(<CnpjInput id="cnpj" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '12abc34501de35' } });
    expect(onChange).toHaveBeenCalledWith('12.ABC.345/01DE-35');
  });
});
