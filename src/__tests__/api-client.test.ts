import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing api-client
vi.mock('../config.js', () => ({
  MODA_API_KEY: 'moda_sk_test_key',
  MODA_BASE_URL: 'https://test.modaflows.com',
}));

import { callDataAPI, ApiError } from '../api-client.js';

describe('callDataAPI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs correct URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await callDataAPI('/overview?days_back=7');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.modaflows.com/api/v1/data/overview?days_back=7',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'moda_sk_test_key',
        }),
      })
    );
  });

  it('throws ApiError on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));

    await expect(callDataAPI('/overview')).rejects.toThrow('API error (401): Unauthorized');
    await vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));
    try {
      await callDataAPI('/overview');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).statusCode).toBe(401);
    }
  });

  it('retries on 500 errors', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Internal Server Error') })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: 'ok' }) });
    vi.stubGlobal('fetch', mockFetch);

    const result = await callDataAPI('/overview');
    expect(result).toEqual({ data: 'ok' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx errors (except 429)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(callDataAPI('/overview')).rejects.toThrow('API error (403)');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: { total: 100 } }),
    }));

    const result = await callDataAPI('/overview');
    expect(result).toEqual({ conversations: { total: 100 } });
  });
});
