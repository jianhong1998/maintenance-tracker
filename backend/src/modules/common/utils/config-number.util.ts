import type { ConfigService } from '@nestjs/config';

/**
 * Reads a numeric env var via ConfigService, coercing string values.
 * `process.env` values are always strings; ConfigService.get<number>() does not coerce at runtime.
 */
export const readNumericEnv = (params: {
  configService: ConfigService;
  key: string;
  fallback: number;
}): number => {
  const raw = params.configService.get<string | number>(params.key);
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : params.fallback;
  }
  if (typeof raw !== 'string' || raw.trim() === '') return params.fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : params.fallback;
};
