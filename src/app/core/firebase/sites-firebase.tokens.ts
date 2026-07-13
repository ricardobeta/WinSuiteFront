import { InjectionToken, Provider } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Database, getDatabase } from 'firebase/database';
import { FirebaseStorage, getStorage } from 'firebase/storage';

import { environment } from '../../../environments/environment';

export const SITES_FIREBASE_APP = new InjectionToken<FirebaseApp>('SITES_FIREBASE_APP');
export const SITES_AUTH = new InjectionToken<Auth>('SITES_AUTH');
export const SITES_DATABASE = new InjectionToken<Database>('SITES_DATABASE');
export const SITES_STORAGE = new InjectionToken<FirebaseStorage>('SITES_STORAGE');

export function provideSitesFirebase(): Provider[] {
  return [
    {
      provide: SITES_FIREBASE_APP,
      useFactory: () =>
        getApps().find((app) => app.name === 'winsuite-sites') ??
        initializeApp(environment.sitesFirebase, 'winsuite-sites')
    },
    { provide: SITES_AUTH, useFactory: (app: FirebaseApp) => getAuth(app), deps: [SITES_FIREBASE_APP] },
    { provide: SITES_DATABASE, useFactory: (app: FirebaseApp) => getDatabase(app), deps: [SITES_FIREBASE_APP] },
    { provide: SITES_STORAGE, useFactory: (app: FirebaseApp) => getStorage(app), deps: [SITES_FIREBASE_APP] }
  ];
}
