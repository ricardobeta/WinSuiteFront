export interface ModuleCatalogEntry {
  id: string;
  label: string;
  icon: string;
  description: string;
  locked: boolean;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    description: 'Panel general con las metricas clave de tu negocio.',
    locked: true
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: 'group',
    description: 'Gestiona tu cartera de clientes y contactos.',
    locked: true
  },
  {
    id: 'facturacion',
    label: 'Facturacion',
    icon: 'receipt_long',
    description: 'Emite comprobantes electronicos autorizados por el SRI.',
    locked: false
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: 'shopping_bag',
    description: 'Punto de venta, resumen de ventas e informes.',
    locked: false
  },
  {
    id: 'servicios',
    label: 'Servicios',
    icon: 'build_circle',
    description: 'Cataloga y gestiona los servicios que ofreces.',
    locked: false
  },
  {
    id: 'asistente_ventas',
    label: 'Asistente Ventas',
    icon: 'forum',
    description: 'Asistente de ventas por WhatsApp con inteligencia artificial.',
    locked: false
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: 'inventory_2',
    description: 'Control de productos, proveedores y almacenes.',
    locked: false
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    icon: 'account_balance',
    description: 'Plan de cuentas, asientos y reportes contables.',
    locked: false
  },
  {
    id: 'colaboradores',
    label: 'Colaboradores',
    icon: 'supervisor_account',
    description: 'Administra usuarios, roles y permisos de tu equipo.',
    locked: false
  },
  {
    id: 'archivos',
    label: 'Archivos',
    icon: 'drive_folder_upload',
    description: 'Almacenamiento y gestion documental.',
    locked: false
  }
];

export const DEFAULT_ACTIVE_MODULES: string[] = MODULE_CATALOG.map((module) => module.id);

export const MANDATORY_MODULES: string[] = MODULE_CATALOG.filter((module) => module.locked).map(
  (module) => module.id
);

export function getModuleCatalogEntry(id: string): ModuleCatalogEntry | undefined {
  return MODULE_CATALOG.find((module) => module.id === id);
}
