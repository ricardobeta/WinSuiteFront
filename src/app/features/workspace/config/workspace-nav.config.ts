import { NavItem } from '../../../core/models/navigation.models';
import { getModuleCatalogEntry } from '../../../core/config/module-catalog';

function moduleMeta(moduleId: string): { label: string; icon: string } {
  const entry = getModuleCatalogEntry(moduleId);
  if (!entry) {
    throw new Error(`Unknown module id in catalog: ${moduleId}`);
  }
  return entry;
}

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: moduleMeta('dashboard').label,
    icon: moduleMeta('dashboard').icon,
    route: '/workspace/dashboard'
  },
  {
    id: 'users',
    label: moduleMeta('clientes').label,
    icon: moduleMeta('clientes').icon,
    route: '/workspace/customers/lista',
    requiredModule: 'clientes',
    requiredAction: 'read'
  },
  {
    id: 'billing',
    label: moduleMeta('facturacion').label,
    icon: moduleMeta('facturacion').icon,
    requiredModule: 'facturacion',
    requiredAction: 'read',
    children: [
      {
        id: 'billing-signatures',
        label: 'Firmas',
        icon: 'badge',
        route: '/workspace/facturacion/firmas',
        requiredModule: 'facturacion',
        requiredAction: 'read'
      },
      {
        id: 'billing-sri',
        label: 'SRI',
        icon: 'cloud_download',
        route: '/workspace/facturacion/sri',
        requiredModule: 'facturacion',
        requiredAction: 'read'
      },
      {
        id: 'billing-config',
        label: 'Configuración',
        icon: 'tune',
        route: '/workspace/facturacion/configuracion',
        requiredModule: 'facturacion',
        requiredAction: 'update'
      }
    ]
  },
  {
    id: 'sales',
    label: moduleMeta('ventas').label,
    icon: moduleMeta('ventas').icon,
    requiredModule: 'ventas',
    requiredAction: 'read',
    children: [
      {
        id: 'products',
        label: 'POS',
        icon: 'inventory_2',
        route: '/workspace/ventas/pos',
        requiredModule: 'ventas',
        requiredAction: 'create'
      },
      {
        id: 'orders',
        label: 'Resumen',
        icon: 'receipt_long',
        route: '/workspace/ventas/resumen',
        requiredModule: 'ventas',
        requiredAction: 'read'
      },
      {
        id: 'reports',
        label: 'Informes',
        icon: 'insert_chart',
        route: '/workspace/ventas/informes',
        requiredModule: 'ventas',
        requiredAction: 'read'
      },
      {
        id: 'sales-config',
        label: 'Configuración',
        icon: 'tune',
        route: '/workspace/ventas/configuracion',
        requiredModule: 'ventas',
        requiredAction: 'update'
      }
    ]
  },
  {
    id: 'services',
    label: moduleMeta('servicios').label,
    icon: moduleMeta('servicios').icon,
    requiredModule: 'servicios',
    requiredAction: 'read',
    children: [
      {
        id: 'services-lista',
        label: 'Lista',
        icon: 'format_list_bulleted',
        route: '/workspace/servicios/lista',
        requiredModule: 'servicios',
        requiredAction: 'read'
      },
      {
        id: 'services-config',
        label: 'Configuracion',
        icon: 'tune',
        route: '/workspace/servicios/configuracion',
        requiredModule: 'servicios',
        requiredAction: 'update'
      }
    ]
  },
  {
    id: 'asistente-ventas',
    label: moduleMeta('asistente_ventas').label,
    icon: moduleMeta('asistente_ventas').icon,
    requiredModule: 'asistente_ventas',
    requiredAction: 'read',
    children: [
      {
        id: 'asistente-instancias',
        label: 'Instancias',
        icon: 'hub',
        route: '/workspace/asistente-ventas/instancias',
        requiredModule: 'asistente_ventas',
        requiredAction: 'read'
      },
      {
        id: 'asistente-plantillas',
        label: 'Plantillas',
        icon: 'edit_note',
        route: '/workspace/asistente-ventas/plantillas',
        requiredModule: 'asistente_ventas',
        requiredAction: 'update'
      },
      {
        id: 'asistente-flujos',
        label: 'Flujos',
        icon: 'schema',
        route: '/workspace/asistente-ventas/flujos',
        requiredModule: 'asistente_ventas',
        requiredAction: 'update'
      },
      {
        id: 'asistente-conversaciones',
        label: 'Conversaciones',
        icon: 'chat',
        route: '/workspace/asistente-ventas/conversaciones',
        requiredModule: 'asistente_ventas',
        requiredAction: 'read'
      },
      {
        id: 'asistente-funnels',
        label: 'Funnels',
        icon: 'insights',
        route: '/workspace/asistente-ventas/funnels',
        requiredModule: 'asistente_ventas',
        requiredAction: 'read'
      },
      {
        id: 'asistente-conocimiento',
        label: 'Base de conocimiento',
        icon: 'auto_awesome',
        route: '/workspace/asistente-ventas/conocimiento',
        requiredModule: 'asistente_ventas',
        requiredAction: 'update'
      }
    ]
  },
  {
    id: 'inventory',
    label: moduleMeta('inventario').label,
    icon: moduleMeta('inventario').icon,
    requiredModule: 'inventario',
    requiredAction: 'read',
    children: [
      {
        id: 'inventory-products',
        label: 'Productos',
        icon: 'category',
        route: '/workspace/inventario/productos',
        requiredModule: 'inventario',
        requiredAction: 'read'
      },
      {
        id: 'inventory-suppliers',
        label: 'Proveedores',
        icon: 'storefront',
        route: '/workspace/inventario/proveedores',
        requiredModule: 'inventario',
        requiredAction: 'read'
      },
      {
        id: 'inventory-purchase-orders',
        label: 'Ordenes de compra',
        icon: 'shopping_cart_checkout',
        route: '/workspace/inventario/ordenes-compra',
        requiredModule: 'inventario',
        requiredAction: 'read'
      },
      {
        id: 'inventory-costs',
        label: 'Costos',
        icon: 'monitoring',
        route: '/workspace/inventario/costos',
        requiredModule: 'inventario',
        requiredAction: 'update'
      },
      {
        id: 'inventory-warehouses',
        label: 'Almacenes',
        icon: 'warehouse',
        route: '/workspace/inventario/almacenes',
        requiredModule: 'inventario',
        requiredAction: 'update'
      },
      {
        id: 'inventory-config',
        label: 'Configuracion',
        icon: 'tune',
        route: '/workspace/inventario/configuracion',
        requiredModule: 'inventario',
        requiredAction: 'update'
      }
    ]
  },
  {
    id: 'accounting',
    label: moduleMeta('contabilidad').label,
    icon: moduleMeta('contabilidad').icon,
    requiredModule: 'contabilidad',
    requiredAction: 'read',
    children: [
      {
        id: 'accounting-chart',
        label: 'Plan de cuentas',
        icon: 'account_tree',
        route: '/workspace/contabilidad/plan-cuentas',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-config',
        label: 'Configuracion',
        icon: 'tune',
        route: '/workspace/contabilidad/configuracion',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-journals',
        label: 'Asientos contables',
        icon: 'receipt_long',
        route: '/workspace/contabilidad/asientos',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-purchases',
        label: 'Compras',
        icon: 'shopping_cart',
        route: '/workspace/contabilidad/compras',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-payables',
        label: 'Cuentas por Pagar',
        icon: 'request_quote',
        route: '/workspace/contabilidad/cuentas-por-pagar',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-banks',
        label: 'Bancos',
        icon: 'account_balance_wallet',
        route: '/workspace/contabilidad/bancos',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-reports',
        label: 'Reportes',
        icon: 'insert_chart',
        route: '/workspace/contabilidad/reportes',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-ats',
        label: 'ATS',
        icon: 'summarize',
        route: '/workspace/contabilidad/ats',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      },
      {
        id: 'accounting-payroll',
        label: 'Nomina',
        icon: 'payments',
        route: '/workspace/contabilidad/nomina',
        requiredModule: 'contabilidad',
        requiredAction: 'read'
      }
    ]
  },
  {
    id: 'archivos',
    label: moduleMeta('archivos').label,
    icon: moduleMeta('archivos').icon,
    route: '/workspace/archivos/lista',
    requiredModule: 'archivos',
    requiredAction: 'read'
  },
  {
    id: 'sitio-web',
    label: moduleMeta('sitio_web').label,
    icon: moduleMeta('sitio_web').icon,
    route: '/workspace/sitio-web',
    requiredModule: 'sitio_web',
    requiredAction: 'read'
  }
];
