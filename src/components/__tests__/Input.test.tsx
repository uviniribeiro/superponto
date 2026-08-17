import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/input';

describe('Input Component', () => {
  it('should render input element', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Enter text" />);
    expect(getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should handle value changes', () => {
    const handleChange = vi.fn();
    const { getByRole } = render(<Input onChange={handleChange} />);

    const input = getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(handleChange).toHaveBeenCalled();
  });


  it('should be disabled when disabled prop is true', () => {
    const { getByRole } = render(<Input disabled />);
    expect(getByRole('textbox')).toBeDisabled();
  });

  it('should apply type attribute correctly', () => {
    const { getByTestId } = render(<Input type="email" data-testid="email-input" />);
    expect(getByTestId('email-input')).toHaveAttribute('type', 'email');
  });

  it('should apply custom className', () => {
    const { getByRole } = render(<Input className="custom-class" />);
    expect(getByRole('textbox')).toHaveClass('custom-class');
  });
});
