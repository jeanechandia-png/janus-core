import { Worker } from 'node:worker_threads';

/**
 * Ejecutor de código para el nodo `code` (equivalente al «Code node» de n8n, sin copiarlo).
 *
 * JavaScript: se ejecuta FUERA del hilo principal (worker) y dentro de un contexto `vm` vacío:
 *  - sin `process`, `require`, `fetch`, `import`, sistema de archivos ni red;
 *  - `eval` / `new Function` desactivados (codeGeneration.strings = false);
 *  - la entrada entra como JSON y la salida sale como JSON (ningún objeto del anfitrión cruza al contexto);
 *  - límite de tiempo (vm + terminación del worker) y de memoria (resourceLimits).
 *
 * LÍMITE DECLARADO (verdad): `vm` + worker NO es una frontera de seguridad frente a código hostil de terceros.
 * Sirve para código escrito o aprobado por Jean. Para código no confiable hace falta aislamiento fuerte
 * (QuickJS en WASM o contenedor) conectado a esta misma interfaz `CodeRunner`.
 *
 * Python: no disponible todavía (requiere Pyodide/WASM o contenedor). `UnsupportedCodeRunner` lo dice sin disimulo.
 */
export type CodeLanguage = 'javascript' | 'python';

export interface CodeRunRequest {
  language: CodeLanguage;
  source: string;
  input?: unknown;
  timeoutMs?: number;
  memoryMb?: number;
}

export interface CodeRunResult {
  ok: boolean;
  output?: unknown;
  error?: string;
  logs: string[];
  durationMs: number;
}

export interface CodeRunner {
  run(request: CodeRunRequest): Promise<CodeRunResult>;
}

export const CODE_LIMITS = { maxSourceChars: 20_000, maxInputBytes: 256 * 1024, maxOutputBytes: 256 * 1024, defaultTimeoutMs: 2_000, defaultMemoryMb: 64 } as const;

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
function done(msg) { parentPort.postMessage(msg); }
try {
  const ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(
    'var __logs = []; var console = { log: function () { var a = Array.prototype.slice.call(arguments).map(function (x) { return typeof x === "string" ? x : JSON.stringify(x); }).join(" "); if (__logs.length < 50) __logs.push(a.slice(0, 500)); } };' +
    'var input = JSON.parse(' + JSON.stringify(workerData.inputJson) + ');',
    ctx, { timeout: workerData.timeoutMs });
  const wrapped = '(function () { "use strict"; return (function (input) {' + workerData.source + '\\n})(input); })()';
  const raw = vm.runInContext('(function () { var r = ' + wrapped + '; return r === undefined ? "null" : JSON.stringify(r); })()', ctx, { timeout: workerData.timeoutMs });
  const logs = vm.runInContext('JSON.stringify(__logs)', ctx, { timeout: workerData.timeoutMs });
  done({ ok: true, outputJson: raw, logsJson: logs });
} catch (e) {
  done({ ok: false, error: String(e && e.message ? e.message : e).slice(0, 500) });
}
`;

export class WorkerJsCodeRunner implements CodeRunner {
  async run(request: CodeRunRequest): Promise<CodeRunResult> {
    const started = Date.now();
    const fail = (error: string, logs: string[] = []): CodeRunResult => ({ ok: false, error, logs, durationMs: Date.now() - started });
    if (request.language !== 'javascript') return fail(`Lenguaje no soportado por este ejecutor: ${request.language}`);
    if (!request.source.trim()) return fail('El nodo de código está vacío');
    if (request.source.length > CODE_LIMITS.maxSourceChars) return fail('El código supera el tamaño máximo permitido');

    let inputJson: string;
    try {
      inputJson = JSON.stringify(request.input === undefined ? null : request.input);
    } catch {
      return fail('La entrada del nodo de código no es serializable a JSON');
    }
    if (Buffer.byteLength(inputJson, 'utf8') > CODE_LIMITS.maxInputBytes) return fail('La entrada del nodo de código es demasiado grande');

    const timeoutMs = Math.min(Math.max(request.timeoutMs ?? CODE_LIMITS.defaultTimeoutMs, 50), 30_000);
    const memoryMb = Math.min(Math.max(request.memoryMb ?? CODE_LIMITS.defaultMemoryMb, 16), 256);

    return await new Promise<CodeRunResult>((resolve) => {
      let settled = false;
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: { source: request.source, inputJson, timeoutMs },
        resourceLimits: { maxOldGenerationSizeMb: memoryMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
        env: {},
        stdout: false,
        stderr: false,
      });
      const finish = (result: CodeRunResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        resolve(result);
      };
      const timer = setTimeout(() => finish(fail(`El código superó el tiempo máximo (${timeoutMs} ms)`)), timeoutMs + 250);
      worker.once('message', (msg: { ok: boolean; outputJson?: string; logsJson?: string; error?: string }) => {
        if (!msg.ok) return finish(fail(msg.error ?? 'Error de ejecución'));
        const out = msg.outputJson ?? 'null';
        if (Buffer.byteLength(out, 'utf8') > CODE_LIMITS.maxOutputBytes) return finish(fail('La salida del código es demasiado grande'));
        let logs: string[] = [];
        try { logs = JSON.parse(msg.logsJson ?? '[]') as string[]; } catch { /* sin logs */ }
        try {
          finish({ ok: true, output: JSON.parse(out), logs, durationMs: Date.now() - started });
        } catch {
          finish(fail('La salida del código no es JSON válido', logs));
        }
      });
      worker.once('error', (error: Error & { code?: string }) => {
        finish(fail(error.code === 'ERR_WORKER_OUT_OF_MEMORY' ? `El código superó el límite de memoria (${memoryMb} MB)` : `Error del ejecutor: ${error.message.slice(0, 300)}`));
      });
      worker.once('exit', (code) => {
        if (!settled && code !== 0) finish(fail('El ejecutor terminó de forma inesperada'));
      });
    });
  }
}

export class UnsupportedCodeRunner implements CodeRunner {
  constructor(private readonly reason = 'Ejecutor de código no configurado') {}
  async run(_request: CodeRunRequest): Promise<CodeRunResult> {
    return { ok: false, error: this.reason, logs: [], durationMs: 0 };
  }
}

/** Enruta por lenguaje. Python queda declarado como no disponible hasta conectar un ejecutor aislado (Pyodide/WASM o contenedor). */
export class CodeRunnerRouter implements CodeRunner {
  constructor(
    private readonly runners: Partial<Record<CodeLanguage, CodeRunner>> = {
      javascript: new WorkerJsCodeRunner(),
      python: new UnsupportedCodeRunner('Python aún no está disponible: requiere un ejecutor aislado (Pyodide/WASM o contenedor). Pendiente.'),
    },
  ) {}
  run(request: CodeRunRequest): Promise<CodeRunResult> {
    const runner = this.runners[request.language];
    return runner ? runner.run(request) : Promise.resolve({ ok: false, error: `Sin ejecutor para ${request.language}`, logs: [], durationMs: 0 });
  }
}
