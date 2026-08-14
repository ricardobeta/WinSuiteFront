/**
 * Datos legales de la empresa titular de WinSuit.
 *
 * IMPORTANTE: estos valores se publican en /legal/* y son los que Meta contrasta,
 * caracter por caracter, contra el RUC y contra lo cargado en Business Manager.
 * Deben coincidir de forma exacta: tildes, puntos y sufijo societario incluidos.
 *
 * Un campo en cadena vacia se renderiza como "Pendiente de completar" y se omite
 * del JSON-LD, para que una pagina a medio llenar se note en vez de mentir.
 */

export interface TelefonoEmpresa {
  /** Como se muestra al lector. Ej: '+593 99 667 1547'. */
  readonly display: string;
  /** Formato E.164 para el enlace tel:. Ej: '+593996671547'. */
  readonly tel: string;
  /** Solo digitos con codigo de pais, para wa.me. Ej: '593996671547'. */
  readonly whatsapp: string;
}

export interface RepresentanteLegal {
  readonly nombre: string;
  readonly cargo: string;
}

export interface DatosEmpresa {
  readonly razonSocial: string;
  readonly nombreComercial: string;
  readonly ruc: string;
  readonly representanteLegal: RepresentanteLegal;
  readonly direccion: string;
  readonly ciudad: string;
  readonly pais: string;
  readonly telefono: TelefonoEmpresa;
  readonly email: string;
  readonly horario: string;
  readonly sitioWeb: string;
  /** ISO 8601. Se muestra al pie de las tres paginas legales. */
  readonly ultimaActualizacion: string;
}

export const DATOS_EMPRESA: DatosEmpresa = {
  razonSocial: 'CARRERA MONTERO ELENA MAYTE',
  nombreComercial: 'WinSuit',
  ruc: '1724459704001',
  representanteLegal: {
    nombre: 'CARRERA MONTERO ELENA MAYTE',
    cargo: 'Representante Legal',
  },
  direccion: 'Barrio: COLLAS Calle: PASEO PROGRESO 3 Número: 3 Intersección: PROGRESO Conjunto: ROCA VIVA Referencia: FRENTE AL CONJUNTO MONTECARLO 4',
  ciudad: 'Quito',
  pais: 'Ecuador',
  telefono: {
    display: '+593 99 667 1547',
    tel: '+593996671547',
    whatsapp: '593996671547',
  },
  email: 'emcarrera106@gmail.com',
  horario: '',
  sitioWeb: 'https://winsuit.app',
  ultimaActualizacion: '2026-07-30',
};

/** Texto que ocupa el lugar de un dato aun no confirmado. */
export const DATO_PENDIENTE = 'Pendiente de completar';

/**
 * Construye el JSON-LD schema.org/Organization omitiendo los campos vacios.
 * Es la senal estructurada que leen los verificadores automaticos de Meta y Google.
 */
export function construirOrganizationJsonLd(empresa: DatosEmpresa = DATOS_EMPRESA): string {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: empresa.nombreComercial,
    url: empresa.sitioWeb,
    logo: `${empresa.sitioWeb}/images/winsuite-logo.png`,
    telephone: empresa.telefono.tel,
  };

  if (empresa.razonSocial) {
    jsonLd['legalName'] = empresa.razonSocial;
  }
  if (empresa.ruc) {
    jsonLd['taxID'] = empresa.ruc;
    jsonLd['vatID'] = empresa.ruc;
  }
  if (empresa.email) {
    jsonLd['email'] = empresa.email;
  }
  if (empresa.direccion) {
    jsonLd['address'] = {
      '@type': 'PostalAddress',
      streetAddress: empresa.direccion,
      addressLocality: empresa.ciudad || undefined,
      addressCountry: 'EC',
    };
  }
  if (empresa.representanteLegal.nombre) {
    jsonLd['employee'] = {
      '@type': 'Person',
      name: empresa.representanteLegal.nombre,
      jobTitle: empresa.representanteLegal.cargo,
    };
  }

  jsonLd['contactPoint'] = {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    telephone: empresa.telefono.tel,
    areaServed: 'EC',
    availableLanguage: 'es',
    ...(empresa.email ? { email: empresa.email } : {}),
  };

  return JSON.stringify(jsonLd);
}
