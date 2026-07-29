import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AiConfigCopilotService,
  ConfigApprovedAction,
  ConfigScreenContext
} from './ai-config-copilot.service';

const CONTEXT: ConfigScreenContext = {
  route: '/workspace/inventario/configuracion',
  module: 'Inventario',
  page: 'Configuracion',
  screenKey: 'inventario.configuracion'
};

describe('AiConfigCopilotService', () => {
  let post: ReturnType<typeof vi.fn>;
  let service: AiConfigCopilotService;

  beforeEach(() => {
    post = vi.fn().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [AiConfigCopilotService, { provide: HttpClient, useValue: { post } }]
    });
    service = TestBed.inject(AiConfigCopilotService);
  });

  it('envia el contexto de pantalla y el historial al preguntar', () => {
    service.ask('Tengo una cafeteria', CONTEXT, [{ role: 'user', content: 'hola' }]).subscribe();

    expect(post).toHaveBeenCalledOnce();
    const [url, body] = post.mock.calls[0];
    expect(url).toContain('/api/tenants/current/ai/config-copilot/ask');
    expect(body).toEqual({
      message: 'Tengo una cafeteria',
      context: CONTEXT,
      history: [{ role: 'user', content: 'hola' }]
    });
  });

  it('rellena los campos ausentes de una respuesta incompleta', () => {
    post.mockReturnValue(of({ text: 'listo', plan: [{ id: '1', tipo: 'crear_categoria' }] }));

    let recibido: unknown;
    service.ask('hola', CONTEXT).subscribe((respuesta) => (recibido = respuesta));

    expect(recibido).toMatchObject({
      text: 'listo',
      usedSources: [],
      avisos: [],
      planTruncado: false,
      plan: [
        {
          id: '1',
          tipo: 'crear_categoria',
          resumen: 'crear_categoria',
          detalle: null,
          payload: {},
          advertencias: [],
          dependeDe: []
        }
      ]
    });
  });

  it('descarta acciones sin identificador y normaliza un riesgo desconocido', () => {
    post.mockReturnValue(
      of({
        plan: [
          { tipo: 'crear_unidad' },
          { id: '2', tipo: 'crear_unidad', riesgo: 'CATASTROFICO' }
        ]
      })
    );

    let recibido: { plan: Array<{ id: string; riesgo: string }> } | undefined;
    service.ask('hola', CONTEXT).subscribe((respuesta) => (recibido = respuesta));

    expect(recibido?.plan).toHaveLength(1);
    expect(recibido?.plan[0]).toMatchObject({ id: '2', riesgo: 'MEDIO' });
  });

  it('envia solo las acciones aprobadas al aplicar', () => {
    const acciones: ConfigApprovedAction[] = [
      { id: '1', tipo: 'crear_unidad', payload: { nombre: 'Litro' }, dependeDe: [] }
    ];

    service.apply(CONTEXT, acciones).subscribe();

    const [url, body] = post.mock.calls[0];
    expect(url).toContain('/api/tenants/current/ai/config-copilot/apply');
    expect(body).toEqual({ context: CONTEXT, acciones });
  });

  it('normaliza un estado desconocido a ERROR', () => {
    post.mockReturnValue(
      of({ resultados: [{ id: '1', tipo: 'crear_unidad', estado: 'RARO' }], aplicadas: 0 })
    );

    let recibido: { resultados: Array<{ estado: string; mensaje: string }> } | undefined;
    service
      .apply(CONTEXT, [{ id: '1', tipo: 'crear_unidad', payload: {}, dependeDe: [] }])
      .subscribe((respuesta) => (recibido = respuesta));

    expect(recibido?.resultados[0]).toMatchObject({ estado: 'ERROR', mensaje: '' });
  });
});
