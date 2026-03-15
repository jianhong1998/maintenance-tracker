import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};
