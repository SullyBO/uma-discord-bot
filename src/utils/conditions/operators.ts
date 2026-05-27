const OPERATOR_MAP: Record<string, string> = {
  eq: '==',
  not_eq: '!=',
  gt: '>',
  gt_eq: '>=',
  lt: '<',
  lt_eq: '<=',
};

export function normalizeOperator(op: string): string {
  return OPERATOR_MAP[op] ?? op;
}

export function fmtOp(op: string, val: string): string {
  switch (op) {
    case '==':
      return `exactly ${val}`;
    case '!=':
      return `not ${val}`;
    case '>=':
      return `at least ${val}`;
    case '<=':
      return `at most ${val}`;
    case '>':
      return `more than ${val}`;
    case '<':
      return `less than ${val}`;
    default:
      return `${op} ${val}`;
  }
}

export function fmtPositionOp(op: string, val: string): string {
  switch (op) {
    case '==':
      return `exactly ${val}`;
    case '<=':
      return `${val} or better`;
    case '>=':
      return `${val} or worse`;
    case '<':
      return `better than ${val}`;
    case '>':
      return `worse than ${val}`;
    default:
      return `${op} ${val}`;
  }
}

export function ordinalSuffix(val: string): string {
  const n = Number(val);
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function fieldPos(pct: number, fieldSize: number): number {
  return Math.round((fieldSize * pct) / 100);
}
