/** Native builds update through the app stores; nothing to do. */
export const canUpdate = false;
export async function checkForUpdate(_force = false): Promise<'current' | 'updating' | 'unknown'> { return 'current'; }
export const buildId = (): string => 'native';
