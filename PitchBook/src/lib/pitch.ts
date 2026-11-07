export function formatPitchSide(side: number | null | undefined): string {
  return typeof side === 'number' && Number.isFinite(side) && side > 0
    ? `${side} a-side`
    : 'Football pitch';
}
