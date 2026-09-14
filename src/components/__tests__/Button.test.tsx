import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render button with text', () => {
    const { getByRole } = render(<Button>Click me</Button>);
    expect(getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    const { getByRole } = render(<Button onClick={handleClick}>Click me</Button>);
    
    getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    const { getByRole } = render(<Button disabled>Click me</Button>);
    expect(getByRole('button')).toBeDisabled();
  });

  it('should apply variant classes correctly', () => {
    const { getByRole, rerender } = render(<Button variant="destructive">Delete</Button>);
    expect(getByRole('button')).toHaveClass('bg-destructive');

    rerender(<Button variant="outline">Outline</Button>);
    expect(getByRole('button')).toHaveClass('border');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(getByRole('button')).toHaveClass('hover:bg-accent');
  });

  it('should apply size classes correctly', () => {
    const { getByRole, rerender } = render(<Button size="sm">Small</Button>);
    expect(getByRole('button')).toHaveClass('h-9');

    rerender(<Button size="lg">Large</Button>);
    expect(getByRole('button')).toHaveClass('h-12');
  });

  it('should render as child element when asChild is true', () => {
    const { getByRole } = render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    expect(getByRole('link', { name: /link button/i })).toBeInTheDocument();
  });
});
