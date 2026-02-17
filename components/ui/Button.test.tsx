import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders a button with provided text', () => {
    render(<Button>Click me</Button>);
    const buttonElement = screen.getByText(/Click me/i);
    expect(buttonElement).toBeInTheDocument();
  });

  it('renders a button with a specific variant', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const buttonElement = screen.getByText(/Secondary Button/i);
    expect(buttonElement).toBeInTheDocument();
  });

  it('renders a button as a child of another component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const linkElement = screen.getByText(/Link Button/i);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement.tagName).toBe('A');
  });
});
