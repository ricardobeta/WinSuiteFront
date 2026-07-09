import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { Cliente, TipoIdentificacion } from '../../shared/models/clientes.models';

@Injectable({
  providedIn: 'root'
})
export class ClientesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);

  private getBasePath(): string {
    return `clientes/${this.authService.getTenantId()}/lista`;
  }

  getClientes(): Observable<Cliente[]> {
    return new Observable<Cliente[]>((subscriber) => {
      const clientesRef = ref(this.database, this.getBasePath());

      const unsubscribe = onValue(
        clientesRef,
        (snapshot) => {
          const clientes: Cliente[] = [];

          snapshot.forEach((childSnapshot) => {
            clientes.push({
              id: childSnapshot.key ?? undefined,
              ...(childSnapshot.val() as Omit<Cliente, 'id'>)
            });
            return false;
          });

          clientes.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
          subscriber.next(clientes);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  getClienteById(id: string): Observable<Cliente | null> {
    return new Observable<Cliente | null>((subscriber) => {
      const clienteRef = ref(this.database, `${this.getBasePath()}/${id}`);

      const unsubscribe = onValue(
        clienteRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next(null);
            return;
          }

          subscriber.next({ id: snapshot.key ?? id, ...(snapshot.val() as Omit<Cliente, 'id'>) });
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async crearCliente(cliente: Omit<Cliente, 'id'>): Promise<void> {
    await this.crearClienteYRetornarId(cliente);
  }

  async crearClienteYRetornarId(cliente: Omit<Cliente, 'id'>): Promise<string> {
    const clientesRef = ref(this.database, this.getBasePath());
    const nuevoClienteRef = push(clientesRef);
    const timestamp = Date.now();
    const metadata = this.audit.createMetadata('crear', null, timestamp);

    await set(nuevoClienteRef, {
      ...cliente,
      ...metadata
    });

    const clienteId = nuevoClienteRef.key ?? '';
    await this.audit.recordSafe({
      action: 'crear',
      target: {
        module: 'clientes',
        entityType: 'cliente',
        entityId: clienteId,
        label: cliente.nombreCompleto
      },
      summary: `Creo el cliente ${cliente.nombreCompleto}`,
      changesAfter: { nombreCompleto: cliente.nombreCompleto, identificacion: cliente.identificacion }
    });

    return clienteId;
  }

  async actualizarCliente(id: string, datos: Partial<Cliente>): Promise<void> {
    const clienteRef = ref(this.database, `${this.getBasePath()}/${id}`);
    const snapshot = await get(clienteRef);
    const actual = snapshot.exists() ? ({ id, ...(snapshot.val() as Omit<Cliente, 'id'>) } as Cliente) : null;

    await update(clienteRef, {
      ...datos,
      ...this.audit.createMetadata('actualizar', actual)
    });

    await this.audit.recordSafe({
      action: 'actualizar',
      target: {
        module: 'clientes',
        entityType: 'cliente',
        entityId: id,
        label: datos.nombreCompleto ?? actual?.nombreCompleto ?? id
      },
      summary: `Actualizo el cliente ${datos.nombreCompleto ?? actual?.nombreCompleto ?? id}`,
      changesBefore: actual ? { nombreCompleto: actual.nombreCompleto, identificacion: actual.identificacion } : null,
      changesAfter: { nombreCompleto: datos.nombreCompleto, identificacion: datos.identificacion }
    });
  }

  async eliminarCliente(id: string): Promise<void> {
    const clienteRef = ref(this.database, `${this.getBasePath()}/${id}`);
    const snapshot = await get(clienteRef);
    const actual = snapshot.exists() ? ({ id, ...(snapshot.val() as Omit<Cliente, 'id'>) } as Cliente) : null;
    await remove(clienteRef);
    await this.audit.recordSafe({
      action: 'eliminar',
      target: {
        module: 'clientes',
        entityType: 'cliente',
        entityId: id,
        label: actual?.nombreCompleto ?? id
      },
      summary: `Elimino el cliente ${actual?.nombreCompleto ?? id}`,
      changesBefore: actual ? { nombreCompleto: actual.nombreCompleto, identificacion: actual.identificacion } : null
    });
  }

  async buscarClientePorIdentificacion(
    identificacion: string,
    tipoDeIdentificacion: TipoIdentificacion
  ): Promise<Cliente | null> {
    const snapshot = await get(ref(this.database, this.getBasePath()));

    if (!snapshot.exists()) {
      return null;
    }

    const clientes = Object.entries(snapshot.val() as Record<string, Omit<Cliente, 'id'>>);
    const encontrado = clientes.find(([, cliente]) => {
      return cliente.identificacion === identificacion && cliente.tipoDeIdentificacion === tipoDeIdentificacion;
    });

    if (!encontrado) {
      return null;
    }

    const [id, cliente] = encontrado;
    return { id, ...cliente };
  }
}
