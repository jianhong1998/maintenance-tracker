import { ValueTransformer } from 'typeorm';

export const dateTransformer: ValueTransformer = {
  to: (value: Date | null | undefined): Date | null | undefined => value,
  from: (value: string | null): Date | null =>
    value === null ? null : new Date(`${value}T00:00:00`),
};
