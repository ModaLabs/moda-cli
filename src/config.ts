// src/config.ts

export const VERSION = '1.0.2';

export const MODA_API_KEY = process.env.MODA_API_KEY;
export const MODA_BASE_URL =
  process.env.MODA_BASE_URL || 'https://modaflows.com';
export const PORT = parseInt(process.env.PORT || '3003', 10);

export function validateConfig(): void {
  if (!MODA_API_KEY) {
    console.error('Error: MODA_API_KEY environment variable is required');
    console.error('Get your API key from https://modaflows.com/settings');
    process.exit(1);
  }
}
