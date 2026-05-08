export function capitalize(str: string): string {
  /* v8 ignore next */
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatUmaVersion(str: string): string {
  return capitalize(str.replace(/_/g, ' '));
}

export function formatOperator(operator: string): string {
  const map: Record<string, string> = {
    eq: '=',
    not_eq: '≠',
    gt: '>',
    gt_eq: '≥',
    lt: '<',
    lt_eq: '≤',
  };
  return map[operator] ?? operator;
}

type LogStatus = 'ok' | 'error';

export function logRequest(path: string, status: number, ms: number, outcome: LogStatus): void {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const arrow = outcome === 'ok' ? '→' : '✗';
  console.log(`[${timestamp}] apiFetch GET ${path} ${arrow} ${status} (${ms}ms)`);
}
