import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMessage from '@/components/ChatMessage';

describe('ChatMessage', () => {
  it('renders user message content correctly', () => {
    const msg = {
      id: '1',
      role: 'user' as const,
      content: 'Hello from user',
      timestamp: 1718000000000,
    };

    render(<ChatMessage msg={msg} />);

    expect(screen.getByText('Hello from user')).toBeInTheDocument();
  });

  it('renders assistant message with model name', () => {
    const msg = {
      id: '2',
      role: 'assistant' as const,
      content: 'I am Claude',
      timestamp: 1718000000000,
      model: 'claude-sonnet-4-20250514',
    };

    render(<ChatMessage msg={msg} />);

    expect(screen.getByText('I am Claude')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
  });

  it('shows timestamp for messages', () => {
    // Use a specific date for predictable output
    const date = new Date('2024-06-10T12:30:00').getTime();
    const msg = {
      id: '3',
      role: 'user' as const,
      content: 'Hi',
      timestamp: date,
    };

    render(<ChatMessage msg={msg} />);

    // Intl format for zh-CN: hh:mm:ss
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('renders assistant message when no model is provided (falls back to currentModel)', () => {
    const msg = {
      id: '4',
      role: 'assistant' as const,
      content: 'Hello',
      timestamp: 1718000000000,
    };

    render(<ChatMessage msg={msg} />);

    // Default model from store is 'claude-sonnet-4-20250514', but the component
    // displays msg.model || 'AI' — since msg.model is undefined, it shows 'AI'
    expect(screen.getByText('AI')).toBeInTheDocument();
  });
});
