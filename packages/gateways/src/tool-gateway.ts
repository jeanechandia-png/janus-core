import type {
  ToolAdapter,
  ToolGateway,
  ToolProgress,
  ToolRequest,
  ToolResult,
} from './contracts.js';

export class DefaultToolGateway implements ToolGateway {
  private readonly adapters = new Map<string, ToolAdapter>();

  register(adapter: ToolAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Tool adapter already registered: ${adapter.name}`);
    }
    this.adapters.set(adapter.name, adapter);
  }

  async execute(
    request: ToolRequest,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    if (isPrivilegedToolAction(request.action)) {
      if (!request.idempotencyKey?.trim()) {
        return {
          ok: false,
          error: `Privileged tool action requires an idempotency key: ${request.tool}.${request.action}`,
        };
      }
      if (!validAuthorityPermit(request.authorization)) {
        return {
          ok: false,
          error: `Privileged tool action requires an audited authority permit: ${request.tool}.${request.action}`,
        };
      }
    }

    const adapter = this.adapters.get(request.tool);
    if (!adapter) {
      return {
        ok: false,
        error: `Tool adapter not registered: ${request.tool}`,
      };
    }

    if (!adapter.capabilities.includes(request.action)) {
      return {
        ok: false,
        error: `Action '${request.action}' is not exposed by ${request.tool}`,
      };
    }

    await onProgress({
      phase: 'started',
      message: `${request.tool}.${request.action}`,
    });

    try {
      const result = await adapter.execute(request, onProgress);
      await onProgress({
        phase: 'completed',
        message: result.ok ? 'Acción completada' : 'Acción terminó con error',
        data: result.output,
      });
      return result;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}


const PRIVILEGED_TOOL_ACTION = /(^|[._])(create|update|delete|send|publish|deploy|pay|purchase|rotate|disable|transfer|grant|revoke)([._]|$)/i;

function isPrivilegedToolAction(action: string): boolean {
  return PRIVILEGED_TOOL_ACTION.test(action);
}

function validAuthorityPermit(
  authorization: ToolRequest['authorization'],
): boolean {
  return Boolean(
    authorization?.privileged
      && authorization.authorityDecisionHash
      && /^[a-f0-9]{64}$/i.test(authorization.authorityDecisionHash),
  );
}
