export function capitalize(str: string): string {
  /* v8 ignore next */
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatUmaVersion(str: string): string {
  return capitalize(str.replace(/_/g, ' '));
}
