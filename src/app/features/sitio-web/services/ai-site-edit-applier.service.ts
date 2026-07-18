import { Injectable } from '@angular/core';
import { Bloque, ContenidoSitio, contenidoSitioSchema } from '@winsuite/bloques';
import { AiSiteEditOperation } from './ai-site-generator.service';

/**
 * Aplica planes acotados de la IA sobre el documento real del editor.
 * La validacion zod final vuelve atomica la operacion: un plan invalido no produce
 * un documento parcial ni toca el borrador persistido.
 */
@Injectable({ providedIn: 'root' })
export class AiSiteEditApplierService {
  apply(content: ContenidoSitio, operations: AiSiteEditOperation[]): ContenidoSitio {
    if (!operations.length) throw new Error('La IA no propuso cambios para aplicar.');
    const draft = structuredClone(content) as ContenidoSitio;

    for (const operation of operations) {
      switch (operation.op) {
        case 'patch-theme':
          draft.tema = this.mergePatch(draft.tema, operation.patch);
          break;
        case 'patch-block':
          this.patchBlock(draft, operation.pageId, operation.blockId, operation.patch);
          break;
        case 'insert-block':
          this.insertBlock(draft, operation.pageId, operation.afterBlockId, operation.block);
          break;
        case 'move-block':
          this.moveBlock(draft, operation.pageId, operation.blockId, operation.afterBlockId);
          break;
        case 'delete-block':
          this.deleteBlock(draft, operation.pageId, operation.blockId);
          break;
      }
    }

    const clean = JSON.parse(JSON.stringify(draft)) as ContenidoSitio;
    return contenidoSitioSchema.parse(clean) as ContenidoSitio;
  }

  private patchBlock(
    content: ContenidoSitio,
    pageId: string,
    blockId: string,
    patch: Record<string, unknown>,
  ): void {
    if ('id' in patch || 'tipo' in patch) {
      throw new Error('La IA intento cambiar la identidad de un bloque.');
    }
    const blocks = this.blocks(content, pageId);
    const index = blocks.findIndex(block => block.id === blockId);
    if (index < 0) throw new Error(`El bloque ${blockId} ya no existe.`);
    blocks[index] = this.mergePatch(blocks[index], patch) as Bloque;
    this.touch(content, pageId);
  }

  private insertBlock(
    content: ContenidoSitio,
    pageId: string,
    afterBlockId: string | null | undefined,
    rawBlock: Bloque,
  ): void {
    const blocks = this.blocks(content, pageId);
    const allIds = new Set(Object.values(content.paginas).flatMap(page => page.bloques.map(b => b.id)));
    const block = structuredClone(rawBlock) as Bloque;
    if (!block.id || allIds.has(block.id)) block.id = this.newBlockId(allIds);
    if (block.tipo === 'sistema-producto' || block.tipo === 'sistema-pago') {
      throw new Error('La IA no puede crear zonas funcionales del sistema.');
    }
    if (block.visible !== false) block.visible = true;
    const index = afterBlockId ? blocks.findIndex(item => item.id === afterBlockId) : -1;
    if (afterBlockId && index < 0) throw new Error(`El bloque de referencia ${afterBlockId} ya no existe.`);
    blocks.splice(index + 1, 0, block);
    this.touch(content, pageId);
  }

  private moveBlock(
    content: ContenidoSitio,
    pageId: string,
    blockId: string,
    afterBlockId: string | null | undefined,
  ): void {
    const blocks = this.blocks(content, pageId);
    const from = blocks.findIndex(block => block.id === blockId);
    if (from < 0) throw new Error(`El bloque ${blockId} ya no existe.`);
    this.assertNotProtected(blocks[from], 'mover');
    const [block] = blocks.splice(from, 1);
    const after = afterBlockId ? blocks.findIndex(item => item.id === afterBlockId) : -1;
    if (afterBlockId && after < 0) throw new Error(`El bloque de referencia ${afterBlockId} ya no existe.`);
    blocks.splice(after + 1, 0, block);
    this.touch(content, pageId);
  }

  private deleteBlock(content: ContenidoSitio, pageId: string, blockId: string): void {
    const blocks = this.blocks(content, pageId);
    const index = blocks.findIndex(block => block.id === blockId);
    if (index < 0) throw new Error(`El bloque ${blockId} ya no existe.`);
    this.assertNotProtected(blocks[index], 'eliminar');
    blocks.splice(index, 1);
    this.touch(content, pageId);
  }

  private blocks(content: ContenidoSitio, pageId: string): Bloque[] {
    const page = content.paginas[pageId];
    if (!page) throw new Error(`La pagina ${pageId} ya no existe.`);
    return page.bloques;
  }

  private touch(content: ContenidoSitio, pageId: string): void {
    content.paginas[pageId].actualizadoEn = Date.now();
  }

  private assertNotProtected(block: Bloque, action: string): void {
    if (block.id.startsWith('__zona-') || block.tipo === 'sistema-producto' || block.tipo === 'sistema-pago') {
      throw new Error(`No se puede ${action} una zona funcional del sistema.`);
    }
  }

  private newBlockId(existing: Set<string>): string {
    let id = '';
    do id = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    while (existing.has(id));
    return id;
  }

  /** RFC 7396: objetos se mezclan, arrays/primitivos reemplazan y null elimina. */
  private mergePatch<T>(target: T, patch: Record<string, unknown>): T {
    const base = this.isObject(target) ? structuredClone(target) as Record<string, unknown> : {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        delete base[key];
      } else if (this.isObject(value)) {
        base[key] = this.mergePatch(base[key], value);
      } else {
        base[key] = structuredClone(value);
      }
    }
    return base as T;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
