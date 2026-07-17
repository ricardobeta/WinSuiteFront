import { FirebaseOptions } from 'firebase/app';

export interface AppEnvironment {
  production: boolean;
  firebase: FirebaseOptions;
  firebaseVapidKey?: string;
  sitesFirebase: FirebaseOptions;
  apiBaseUrl: string;
  // URL del worker SRI local (agente) en la maquina del cliente.
  sriWorkerBaseUrl: string;
  // Version minima requerida del agente SRI local. Si el worker reporta una
  // version inferior, el frontend bloquea la descarga y pide actualizar.
  sriWorkerMinVersion: string;
  support?: {
    whatsappPhone: string;
    whatsappMessage: string;
  };
  facturacion?: {
    soloGenerarEnPruebas: boolean;
  };
}

export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  sriWorkerBaseUrl: 'http://127.0.0.1:8010',
  sriWorkerMinVersion: '1.0.020',
  support: {
    whatsappPhone: '',
    whatsappMessage: 'Hola, necesito ayuda con Winsuite.'
  },
  facturacion: {
    // Si está en true, el flujo de facturación se corta después de GENERADO.
    soloGenerarEnPruebas: true
  },
  firebase: {
    apiKey: "AIzaSyDbbvMDSz11Ln6skNGRfvwkfjhxmkagA8g",
    authDomain: "wa-marketing-ea461.firebaseapp.com",
    databaseURL: "https://wa-marketing-ea461-default-rtdb.firebaseio.com",
    projectId: "wa-marketing-ea461",
    storageBucket: "wa-marketing-ea461.firebasestorage.app",
    messagingSenderId: "1098700113511",
    appId: "1:1098700113511:web:ca5e38d15972a3c016f6c2",
    measurementId: "G-S0SRTBVSXJ"
  },
  firebaseVapidKey: '',
  // Durante la migracion puede apuntar al proyecto principal. En despliegue debe
  // reemplazarse por la configuracion publica del proyecto exclusivo de sitios.
  sitesFirebase: {
    apiKey: "AIzaSyAAaIkR7ZDynbp3zKsRAZAx4Orj_nMxV4w",
    authDomain: "win-suite-sites.firebaseapp.com",
    databaseURL: "https://win-suite-sites-default-rtdb.firebaseio.com",
    projectId: "win-suite-sites",
    storageBucket: "win-suite-sites.firebasestorage.app",
    messagingSenderId: "968528387874",
    appId: "1:968528387874:web:161d0633fd059960c28f7b",
    measurementId: "G-QB6ZGBHWLV"
  }
};
