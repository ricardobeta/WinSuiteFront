import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'winsuite-theme';
  private mediaQuery?: MediaQueryList;
  private systemThemeListener?: (event: MediaQueryListEvent) => void;
  private hasManualPreference = false;

  readonly theme = signal<ThemeMode>('light');

  initializeTheme(): void {
    this.setupSystemThemeListener();

    const storedTheme = this.readStoredTheme();
    this.hasManualPreference = storedTheme !== null;

    const preferredTheme = storedTheme ?? this.getSystemTheme();

    this.applyTheme(preferredTheme);
  }

  toggleTheme(): void {
    const nextTheme: ThemeMode = this.theme() === 'dark' ? 'light' : 'dark';
    this.hasManualPreference = true;
    this.applyTheme(nextTheme, true);
  }

  private applyTheme(theme: ThemeMode, persistPreference = false): void {
    this.theme.set(theme);
    this.document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    this.document.documentElement.setAttribute('data-theme', theme);
    this.document.documentElement.style.colorScheme = theme;

    if (persistPreference && typeof window !== 'undefined') {
      window.localStorage.setItem(this.storageKey, theme);
    }
  }

  private setupSystemThemeListener(): void {
    if (typeof window === 'undefined' || this.mediaQuery) {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemThemeListener = (event: MediaQueryListEvent) => {
      if (this.hasManualPreference) {
        return;
      }

      this.applyTheme(event.matches ? 'dark' : 'light');
    };

    this.mediaQuery.addEventListener('change', this.systemThemeListener);
  }

  private readStoredTheme(): ThemeMode | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const storedTheme = window.localStorage.getItem(this.storageKey);
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
  }

  private getSystemTheme(): ThemeMode {
    if (typeof window === 'undefined') {
      return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
