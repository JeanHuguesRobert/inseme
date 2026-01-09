import { describe, it, expect, vi } from 'vitest';

describe('Exemple de test unitaire', () => {
  it('devrait fonctionner avec vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('devrait pouvoir mocker une fonction', () => {
    const mockFn = vi.fn(() => 'mocked');
    expect(mockFn()).toBe('mocked');
    expect(mockFn).toHaveBeenCalled();
  });
});
