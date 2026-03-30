import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parsePositiveInteger(value: string): number | null {
  const n = parseInt(value, 10);
  return value.trim() && !isNaN(n) ? n : null;
}
