/**
 * Subdominios que ningun tenant puede reclamar. Ademas de esta lista (UX temprana),
 * deben pre-sembrarse en RTDB `subdominios/{nombre}` con tenantId "__reservado__"
 * para que la regla `!data.exists()` los haga inreclamables (ver script en docs del modulo).
 */
export const SUBDOMINIOS_RESERVADOS: string[] = [
  'www',
  'api',
  'app',
  'dashboard',
  'admin',
  'mail',
  'smtp',
  'ftp',
  'sites',
  'cdn',
  'static',
  'assets',
  'blog',
  'docs',
  'ayuda',
  'soporte',
  'status',
  'dev',
  'test',
  'staging',
  'demo',
  'winsuite',
  'winsuit',
];

export function esSubdominioReservado(subdominio: string): boolean {
  return SUBDOMINIOS_RESERVADOS.includes(subdominio.toLowerCase());
}
