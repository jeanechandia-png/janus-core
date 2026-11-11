import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { findOperations, type CatalogOperation, type ServiceCatalog } from '../../gateways/src/spec-connector.js';
import type { OperationDescriptor, OperationRisk } from '../../core/src/operation-risk.js';

/**
 * Herramienta `integration`: la puerta por la que el planificador (y por tanto una orden de voz) usa CUALQUIER
 * servicio conectado por su especificación, sin una herramienta nueva por servicio.
 *
 *   operation.find   buscar qué puede hacer un servicio (lectura)
 *   operation.read   ejecutar una operación de LECTURA
 *   operation.write  ejecutar cualquier otra (crear, cambiar, borrar…): SIEMPRE con aprobación del CEO
 *                    (`integration.operation.write` está en SENSITIVE_TOOL_ACTIONS; un planificador no puede rebajarla)
 *
 * Garantía: `operation.read` se niega a ejecutar lo que la clasificación de riesgo no considere lectura, de modo que
 * una escritura no puede colarse etiquetada como lectura. El riesgo se decide por lo que la operación hace.
 */
export interface IntegrationHubOptions {
  listCatalogs(): ServiceCatalog[];
  /** Ejecuta la operación con transporte y credenciales reales (SpecToolAdapter). */
  executeOperation(catalog: ServiceCatalog, operation: CatalogOperation, request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult>;
  classify(descriptor: OperationDescriptor): OperationRisk;
}

export const describeOperation = (catalog: ServiceCatalog, operation: CatalogOperation): OperationDescriptor => ({
  service: catalog.service, operation: operation.id, method: operation.method, path: operation.path, summary: operation.summary,
  ...(operation.graphql ? { graphql: operation.graphql } : {}),
  ...(operation.readOnlyHint ? { readOnlyHint: true } : {}),
  ...(operation.destructiveHint ? { destructiveHint: true } : {}),
});

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export interface IntegrationBriefEntry {
  service: string;
  title: string;
  operations: Array<{ id: string; method: string; summary: string; level: string; parameters: string[]; needsBody: boolean }>;
}

/** Resumen para el planificador: de cada servicio conectado, las operaciones que más se parecen a la orden. */
export function integrationBrief(catalogs: readonly ServiceCatalog[], command: string, classify: IntegrationHubOptions['classify'], perService = 4, maxServices = 6): IntegrationBriefEntry[] {
  return catalogs.slice(0, 40).map((catalog) => ({ catalog, found: findOperations(catalog, command, perService) }))
    .filter((entry) => entry.found.length > 0)
    .slice(0, maxServices)
    .map(({ catalog, found }) => ({
      service: catalog.service, title: catalog.title.slice(0, 80),
      operations: found.map((operation) => ({
        id: operation.id, method: operation.method, summary: operation.summary.slice(0, 140), level: classify(describeOperation(catalog, operation)).level,
        parameters: operation.parameters.map((parameter) => `${parameter.name}${parameter.required ? '*' : ''}`).slice(0, 12), needsBody: operation.bodyRequired,
      })),
    }));
}

export class IntegrationHubAdapter implements ToolAdapter {
  readonly name = 'integration';
  readonly capabilities = ['operation.find', 'operation.read', 'operation.write'];

  constructor(private readonly options: IntegrationHubOptions) {}

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    const input = request.input ?? {};
    const catalogs = this.options.listCatalogs();
    const service = str(input.service, 40);

    if (request.action === 'operation.find') {
      const query = str(input.query, 300);
      const scope = service ? catalogs.filter((catalog) => catalog.service === service) : catalogs;
      if (service && scope.length === 0) return { ok: false, error: `No hay ningún servicio conectado con el nombre «${service}».` };
      const services = integrationBrief(scope, query, this.options.classify, 8, 10);
      return { ok: true, output: { connected: catalogs.map((catalog) => catalog.service), services: services as never } };
    }

    if (request.action !== 'operation.read' && request.action !== 'operation.write') return { ok: false, error: `Acción desconocida: ${request.action}` };
    const catalog = catalogs.find((candidate) => candidate.service === service);
    if (!catalog) return { ok: false, error: service ? `No hay ningún servicio conectado con el nombre «${service}». Conéctelo primero por su especificación.` : 'Falta el nombre del servicio.' };
    const operationId = str(input.operation, 200);
    const operation = catalog.operations.find((candidate) => candidate.id === operationId);
    if (!operation) return { ok: false, error: `«${catalog.service}» no tiene la operación «${operationId}». Use operation.find para ver las disponibles.` };
    const risk = this.options.classify(describeOperation(catalog, operation));
    if (request.action === 'operation.read' && risk.level !== 'auto') {
      return { ok: false, error: `«${catalog.service}.${operation.id}» no es una lectura (${risk.reasons.join('; ')}). Debe pedirse como operation.write, que espera la aprobación del CEO.` };
    }
    const args = input.args && typeof input.args === 'object' && !Array.isArray(input.args) ? input.args as Record<string, unknown> : {};
    const result = await this.options.executeOperation(catalog, operation, { ...request, tool: catalog.service, action: operation.id, input: args as never }, onProgress)
      .catch((error: unknown): ToolResult => ({ ok: false, error: `El servicio no respondió: ${error instanceof Error ? error.message.slice(0, 200) : 'error'}` }));
    return { ...result, ...(result.ok ? { externalReference: `${catalog.service}.${operation.id}` } : {}) };
  }
}
