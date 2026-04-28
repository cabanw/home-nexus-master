import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import DevicesPage from '@/pages/Devices';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/components/ui/button', async () => {
  const actual = await vi.importActual('@/components/ui/button') as any;
  return {
    ...actual,
    buttonVariants: (opts: any = {}) => `btn-${opts?.variant ?? 'default'}`,
  };
});

import { useQuery } from '@tanstack/react-query';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

const mockDevice = {
  id: 'AA:BB:CC:DD:EE:FF',
  name: 'Test Router',
  ip: '192.168.1.1',
  mac: 'AA:BB:CC:DD:EE:FF',
  type: 'unknown',
  status: 'online' as const,
  security: 'unknown',
  lastSeen: new Date().toISOString(),
  bandwidth: 0,
};

describe('DevicesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders loading skeletons while fetching', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    const { container } = render(<DevicesPage />, { wrapper });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error message on scan failure', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Scan failed: 500'),
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<DevicesPage />, { wrapper });
    expect(screen.getByText('Scan failed')).toBeInTheDocument();
    expect(screen.getByText('Scan failed: 500')).toBeInTheDocument();
  });

  it('renders empty state when no devices found', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<DevicesPage />, { wrapper });
    expect(screen.getByText(/no devices found/i)).toBeInTheDocument();
  });

  it('renders device name and IP when data is available', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [mockDevice],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<DevicesPage />, { wrapper });
    expect(screen.getByText('Test Router')).toBeInTheDocument();
    expect(screen.getByText(/192\.168\.1\.1/)).toBeInTheDocument();
  });

  it('shows confirmation dialog before removing a device', async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [mockDevice],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<DevicesPage />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /delete device/i }));
    expect(await screen.findByText(/remove device\?/i)).toBeInTheDocument();
  });
});
