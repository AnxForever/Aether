import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={Home}
        title="No items found"
        description="Try adjusting your search or filters."
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting your search or filters.')
    ).toBeInTheDocument();
  });

  it('renders the icon', () => {
    const { container } = render(
      <EmptyState
        icon={Home}
        title="Empty"
        description="Nothing here."
      />
    );

    // Lucide icons render as SVG elements
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
