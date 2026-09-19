export function formatScore(val: unknown, digits: number = 4): string {
  if (val === undefined || val === null || isNaN(Number(val))) return '-';
  return Number(val).toFixed(digits);
}

export function formatPercent(val: unknown, digits: number = 1): string {
  if (val === undefined || val === null || isNaN(Number(val))) return '0.0%';
  return `${(Number(val) * 100).toFixed(digits)}%`;
}

export function formatMs(val: unknown, digits: number = 1): string {
  if (val === undefined || val === null || isNaN(Number(val))) return '0.0 ms';
  return `${Number(val).toFixed(digits)} ms`;
}
