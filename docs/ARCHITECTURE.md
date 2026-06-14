# Winsuite Frontend Architecture

## Stack
- Angular 21 standalone API.
- Angular Material with custom theme from mockup palette.
- Angular Signals for page state, validation state, loading and auth errors.
- AngularFire (Firebase Auth + Firestore).
- Backend integration via HttpClient to Spring endpoint `POST /api/tenants`.

## Module layout
- `src/app/core/models`: typed contracts for auth, tenant and profile data.
- `src/app/core/services`: app services.
  - `auth.service.ts`: login/register orchestration and signal state.
  - `tenant-api.service.ts`: REST client for tenant creation.
- `src/app/features/auth/pages/login-page`: login UI and signal-based form control.
- `src/app/features/auth/pages/register-page`: 2-step register flow (Usuario + Negocio).
- `src/app/features/workspace/pages/workspace-page`: landing page after auth (blank by now).

## Auth flow (register)
1. User fills Usuario step (fullName, email, password, repeat password).
2. User fills Negocio step (businessName, country, mobilePhone).
3. Frontend creates Firebase user with email/password.
4. Frontend calls backend createTenant endpoint:
   - Payload: `{ name, ownerId, plan }`
   - `ownerId` maps to Firebase `uid`.
5. Frontend stores user profile document in Firestore `users/{uid}` with:
   - `email`, `fullName`, `role=ADMIN`, `tenantId`, `active=true`, `joinedAt`, `userId`, `businessName`, `country`, `mobilePhone`.
6. Password is never persisted in Firestore.
7. On success navigate to `/workspace`.

## Auth flow (login)
1. User signs in with Firebase Auth.
2. On success navigate to `/workspace`.
3. Errors and loading are exposed as signals in `auth.service.ts`.

## Angular 21 template syntax used
- `@if` for conditional rendering (errors, step sections, loading).
- `@for` for rendering register steps and country options.

## Environment
- `src/environments/environment.ts`
  - `firebase`: Firebase config placeholder values.
  - `apiBaseUrl`: backend URL, default `http://localhost:8080`.
