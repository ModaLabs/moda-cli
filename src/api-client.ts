// src/api-client.ts
import { MODA_API_KEY, MODA_BASE_URL } from './config.js';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function callDataAPI(endpoint: string): Promise<unknown> {
  const url = `${MODA_BASE_URL}/api/v1/data${endpoint}`;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': MODA_API_KEY!,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new ApiError(
          `API error (${response.status}): ${errorText}`,
          response.status,
          errorText,
        );

        if (isRetryable(response.status) && attempt < MAX_RETRIES) {
          lastError = error;
          continue;
        }

        throw error;
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;

      const isAbort =
        error instanceof DOMException && error.name === 'AbortError';
      const wrapped = new Error(
        isAbort
          ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`
          : `Network error: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (attempt < MAX_RETRIES) {
        lastError = wrapped;
        continue;
      }

      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}
