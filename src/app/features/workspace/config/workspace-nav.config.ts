import { NavItem } from '../../../core/models/navigation.models';

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/workspace/dashboard'
  },
  {
    id: 'users',
    label: 'Clientes',
    icon: 'group',
    route: '/workspace/customers/lista',
    requiredModule: 'clientes',
    requiredAction: 'read'
  },
  {
    id: 'billing',
    label: 'Facturación',
    icon: 'receipt_long',
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
    label: 'Ventas',
    icon: 'shopping_bag',
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
    label: 'Servicios',
    icon: 'build_circle',
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
    label: 'Asistente Ventas',
    icon: 'forum',
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
      }
    ]
  },
  {
    id: 'inventory',
    label: 'Inventario',
    icon: 'inventory_2',
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
    label: 'Contabilidad',
    icon: 'account_balance',
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
      }
    ]
  },
  {
    id: 'colaboradores',
    label: 'Colaboradores',
    icon: 'supervisor_account',
    requiredModule: 'colaboradores',
    requiredAction: 'read',
    children: [
      {
        id: 'colaboradores-lista',
        label: 'Lista',
        icon: 'groups',
        route: '/workspace/colaboradores/lista',
        requiredModule: 'colaboradores',
        requiredAction: 'read'
      },
      {
        id: 'colaboradores-crear',
        label: 'Crear',
        icon: 'person_add',
        route: '/workspace/colaboradores/nuevo',
        requiredModule: 'colaboradores',
        requiredAction: 'create'
      },
      {
        id: 'colaboradores-roles',
        label: 'Roles',
        icon: 'admin_panel_settings',
        route: '/workspace/colaboradores/roles',
        requiredModule: 'colaboradores',
        requiredAction: 'update'
      }
    ]
  },
  {
    id: 'archivos',
    label: 'Archivos',
    icon: 'drive_folder_upload',
    route: '/workspace/archivos/lista',
    requiredModule: 'archivos',
    requiredAction: 'read'
  }
];
