import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { from, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Interceptor that automatically adds the Firebase auth token
 * to the Authorization header for all HTTP requests.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly authService = inject(AuthService);

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return from(this.authService.getToken()).pipe(
      switchMap((token) => {
        if (!token) {
          return next.handle(request);
        }

        const authenticatedRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });

        return next.handle(authenticatedRequest);
      })
    );
  }
}
