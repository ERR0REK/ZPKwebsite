/**
 * src/hooks/useCloudStore.test.js
 *
 * Unit testy dla useCloudStore — testują logikę state transitions:
 * seed → fetch OK → cloudReady=true → data z chmury
 * seed → fetch FAIL → cloudReady=false → data z seeda
 * realtime event → refresh → data zaktualizowane
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import useCloudStore from './useCloudStore';

// Mock useRealtime — zwraca subscribe + pushToast
const mockSubscribe = jest.fn(() => jest.fn()); // zwraca unsubscribe
jest.mock('../Realtime/RealtimeProvider', () => ({
  useRealtime: () => ({
    subscribe: mockSubscribe,
    pushToast: jest.fn(),
  }),
}));

const SEED_DATA = { personal: [{ name: 'SeedPerson' }], factions: [] };
const CLOUD_DATA = { ok: true, personal: [{ name: 'CloudPerson' }], factions: [] };

describe('useCloudStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts with seed data and cloudReady=null', () => {
    global.fetch.mockResolvedValue({ ok: false });
    const { result } = renderHook(() =>
      useCloudStore({
        endpoint: '/api/test',
        channel: 'test-channel',
        seedData: SEED_DATA,
      })
    );
    expect(result.current.data).toEqual(SEED_DATA);
    expect(result.current.cloudReady).toBeNull();
  });

  it('fetches from cloud and updates data + cloudReady=true', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => CLOUD_DATA,
    });
    const { result } = renderHook(() =>
      useCloudStore({
        endpoint: '/api/test',
        channel: 'test-channel',
        seedData: SEED_DATA,
      })
    );
    await waitFor(() => {
      expect(result.current.cloudReady).toBe(true);
    });
    expect(result.current.data).toEqual(CLOUD_DATA);
  });

  it('falls back to seed when fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() =>
      useCloudStore({
        endpoint: '/api/test',
        channel: 'test-channel',
        seedData: SEED_DATA,
      })
    );
    await waitFor(() => {
      expect(result.current.cloudReady).toBe(false);
    });
    expect(result.current.data).toEqual(SEED_DATA);
    expect(result.current.error).toBe('network error');
  });

  it('applies normalizeFn to cloud response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => CLOUD_DATA,
    });
    const normalizeFn = (res) => res.personal; // extract personal only
    const { result } = renderHook(() =>
      useCloudStore({
        endpoint: '/api/test',
        channel: 'test-channel',
        seedData: SEED_DATA,
        normalizeFn,
      })
    );
    await waitFor(() => {
      expect(result.current.cloudReady).toBe(true);
    });
    expect(result.current.data).toEqual([{ name: 'CloudPerson' }]);
  });

  it('applies mergeFn to combine cloud + seed', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => CLOUD_DATA,
    });
    const mergeFn = (cloud, seed) => ({
      ...cloud,
      personal: [...(cloud.personal || []), ...(seed.personal || [])],
    });
    const { result } = renderHook(() =>
      useCloudStore({
        endpoint: '/api/test',
        channel: 'test-channel',
        seedData: SEED_DATA,
        mergeFn,
      })
    );
    await waitFor(() => {
      expect(result.current.cloudReady).toBe(true);
    });
    expect(result.current.data.personal).toHaveLength(2);
    expect(result.current.data.personal.map((t) => t.name)).toEqual([
      'CloudPerson',
      'SeedPerson',
    ]);
  });

  it('subscribes to Ably channel', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => CLOUD_DATA,
    });
    renderHook(() =>
      useCloudStore({
        endpoint: '/api/test',
        channel: 'test-channel',
        seedData: SEED_DATA,
      })
    );
    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith(
        'test-channel',
        expect.any(Function)
      );
    });
  });

  it('refresh() triggers re-fetch', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => CLOUD_DATA,
    });
    const { result } = renderHook(() =>
      useCloudStore({
        endpoint: '/api/test',
        channel: 'test-channel',
        seedData: SEED_DATA,
      })
    );
    await waitFor(() => {
      expect(result.current.cloudReady).toBe(true);
    });
    // Change mock for refresh
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, personal: [{ name: 'Updated' }], factions: [] }),
    });
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.data.personal[0].name).toBe('Updated');
    });
  });
});
