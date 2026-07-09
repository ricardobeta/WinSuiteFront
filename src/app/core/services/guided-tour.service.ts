import { Injectable, inject } from '@angular/core';
import { driver, type Config, type DriveStep } from 'driver.js';

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class GuidedTourService {
  private readonly auth = inject(AuthService);

  startTour(moduleId: string, steps: DriveStep[], options?: Partial<Config>): void {
    if (!steps.length) {
      return;
    }

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.55)',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Listo',
      progressText: 'Paso {{current}} de {{total}}',
      steps,
      onDestroyStarted: () => {
        this.markSeen(moduleId);
        driverObj.destroy();
      },
      ...options
    });

    driverObj.drive();
  }

  hasSeenTour(moduleId: string): boolean {
    if (typeof localStorage === 'undefined') {
      return true;
    }

    return localStorage.getItem(this.storageKey(moduleId)) === 'true';
  }

  markSeen(moduleId: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey(moduleId), 'true');
  }

  resetSeen(moduleId: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(this.storageKey(moduleId));
  }

  private storageKey(moduleId: string): string {
    const userId = this.auth.currentUser()?.uid ?? 'anon';
    return `winsuite.tour.${userId}.${moduleId}`;
  }
}
