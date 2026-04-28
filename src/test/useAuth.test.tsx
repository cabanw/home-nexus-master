import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

const {
  mockUnsubscribe,
  mockGetSession,
  mockOnAuthStateChange,
  mockSignInWithPassword,
  mockSignOut,
  mockFrom,
} = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  mockOnAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  it('throws when used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
    consoleSpy.mockRestore();
  });

  it('starts with loading true and user null', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('sets loading to false and user to null after getSession resolves with no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it('signIn calls supabase signInWithPassword with correct args', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signIn('user@example.com', 'password123');
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  });
});
