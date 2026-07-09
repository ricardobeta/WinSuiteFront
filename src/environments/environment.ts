import { FirebaseOptions } from 'firebase/app';

export interface AppEnvironment {
  production: boolean;
  firebase: FirebaseOptions;
  apiBaseUrl: string;
  // URL del worker SRI local (agente) en la maquina del cliente.
  sriWorkerBaseUrl: string;
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
  }
};
