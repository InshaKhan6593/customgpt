export function isRsilV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_RSIL_V2 === 'true';
}

export function useRsilV2Flag(): boolean {
  return isRsilV2Enabled();
}
