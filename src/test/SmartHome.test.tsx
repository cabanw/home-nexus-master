import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SmartHomePage from '@/pages/SmartHome';
import type { KasaDevice, KasaLockedDevice } from '@/types/kasa';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ setQueryData: vi.fn() })),
  };
});

vi.mock('@/lib/kasaApi', () => ({
  fetchKasaDevices: vi.fn(),
  setKasaDeviceState: vi.fn(),
  KASA_QUERY_KEY: ['kasa-devices'],
}));

import { useMutation, useQuery } from '@tanstack/react-query';

// Radix Slider measures its track with ResizeObserver, which jsdom does not provide.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const makeDevice = (overrides: Partial<KasaDevice> = {}): KasaDevice => ({
  id: '28:EE:52:00:00:01',
  ip: '192.168.1.20',
  alias: 'Kitchen',
  model: 'HS200(US)',
  deviceName: 'Smart Wi-Fi Light Switch',
  mac: '28:EE:52:00:00:01',
  protocol: 'legacy',
  on: false,
  brightness: null,
  firmware: '1.0.11',
  online: true,
  lastSeen: new Date().toISOString(),
  ...overrides,
});

const mockDiscovery = (
  devices: KasaDevice[],
  { subnets = ['192.168.1.0/24'], skippedSubnets = [] as string[], locked = [] as KasaLockedDevice[] } = {},
) =>
  vi.mocked(useQuery).mockReturnValue({
    data: { subnets, skippedSubnets, locked, discoveredAt: new Date().toISOString(), durationMs: 3100, devices },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as never);

describe('SmartHomePage', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false, variables: undefined } as never);
  });

  it('renders loading skeletons while discovering', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: true, refetch: vi.fn() } as never);

    const { container } = render(<SmartHomePage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the server error when discovery fails', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Sign in to use Kasa devices.'),
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<SmartHomePage />);
    expect(screen.getByText('Discovery failed')).toBeInTheDocument();
    expect(screen.getByText('Sign in to use Kasa devices.')).toBeInTheDocument();
  });

  it('renders an empty state when no switch answers', () => {
    mockDiscovery([]);

    render(<SmartHomePage />);
    expect(screen.getByText(/no kasa switches answered/i)).toBeInTheDocument();
  });

  it('lists switches with how many are on', () => {
    mockDiscovery([makeDevice(), makeDevice({ id: 'b', ip: '192.168.1.21', alias: 'Porch', on: true, protocol: 'klap' })]);

    render(<SmartHomePage />);
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('HS200(US) | 192.168.1.20')).toBeInTheDocument();
    expect(screen.getByText('1/2 on')).toBeInTheDocument();
    expect(screen.getAllByText('KLAP')).toHaveLength(1);
    expect(screen.getByText(/Discovered on 192\.168\.1\.0\/24 in 3\.1s/)).toBeInTheDocument();
  });

  it('warns about subnets that broadcast discovery cannot reach', () => {
    mockDiscovery([makeDevice()], { subnets: ['192.168.1.0/24', '192.168.50.0/24'], skippedSubnets: ['192.168.50.0/24'] });

    render(<SmartHomePage />);
    expect(screen.getByText(/Discovered on 192\.168\.1\.0\/24 in/)).toBeInTheDocument();
    expect(screen.getByText('Not reachable by broadcast from this computer: 192.168.50.0/24')).toBeInTheDocument();
  });

  it('groups switches that cannot be controlled by reason, without switches', () => {
    const reason = 'Add KASA_USERNAME and KASA_PASSWORD to .env to read and control it.';
    mockDiscovery([], {
      locked: [
        { ip: '192.168.1.25', model: 'HS200(US)', mac: '28:EE:52:00:00:25', reason },
        { ip: '192.168.1.27', model: 'HS210(US)', mac: '28:EE:52:00:00:27', reason },
      ],
    });

    render(<SmartHomePage />);
    expect(screen.getByText('Not controllable yet (2)')).toBeInTheDocument();
    expect(screen.getAllByText(reason)).toHaveLength(1);
    expect(screen.getByText('HS210(US) | 192.168.1.27')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText(/no kasa switches answered/i)).not.toBeInTheDocument();
  });

  it('sends the new state when a switch is toggled', () => {
    mockDiscovery([makeDevice()]);

    render(<SmartHomePage />);
    fireEvent.click(screen.getByRole('switch', { name: /turn kitchen on/i }));
    expect(mutate).toHaveBeenCalledWith({ ip: '192.168.1.20', change: { on: true } });
  });

  it('shows a brightness slider only for dimmers', () => {
    mockDiscovery([makeDevice(), makeDevice({ id: 'd', ip: '192.168.1.22', alias: 'Bedroom', model: 'HS220(US)', brightness: 80 })]);

    render(<SmartHomePage />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('disables switches that did not answer the last discovery', () => {
    mockDiscovery([makeDevice({ online: false, on: true })]);

    render(<SmartHomePage />);
    expect(screen.getByText('offline')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByText(/Last seen/)).toBeInTheDocument();
  });
});
