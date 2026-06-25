import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Skeleton from '@/components/Skeleton';

describe('Skeleton', () => {
  it('renders with custom className', () => {
    const { container } = render(<Skeleton className="h-10 w-48" />);

    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('h-10');
    expect(outer.className).toContain('w-48');
  });

  it('has aria-hidden attribute set to true', () => {
    const { container } = render(<Skeleton />);

    const outer = container.firstChild as HTMLElement;
    expect(outer.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the shimmer child div', () => {
    const { container } = render(<Skeleton />);

    const outer = container.firstChild as HTMLElement;
    const shimmer = outer.firstChild as HTMLElement;
    expect(shimmer).toBeInTheDocument();
    expect(shimmer.className).toContain('animate-shimmer');
  });
});
