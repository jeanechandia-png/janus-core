import type { ModelGateway, ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import {
  contextualTranslationMessages,
  interpretText,
  InterpreterError,
  parseTranslationResponse,
  type ProcessingLocation,
  type InterpreterContext,
  type TranslationPort,
} from '../../modules/infinity-interpreter/src/index.js';

/** Thin Janus adapter. Model Gateway owns routing and credentials. */
export class InfinityInterpreterToolAdapter implements ToolAdapter {
  readonly name = 'interpreter';
  readonly capabilities = ['capabilities.get', 'translate.text'];
  constructor(
    private readonly modelGateway: () => ModelGateway | undefined,
    /** Conservative default: the existing router may fall back to a remote model. */
    private readonly processingLocation: ProcessingLocation = 'external',
  ) {}

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported interpreter action: ${request.action}` };
    if (request.action === 'capabilities.get') return {
      ok: true,
      output: {
        module: 'infinity-interpreter',
        version: '0.1.0',
        primaryConsumer: 'connect',
        reusableBy: ['janus', 'melanie', 'iba', 'connect', 'automation'],
        capabilities: ['contextual.text.translation', 'glossary', 'register', 'consecutive.context', 'explicit.external.consent'],
        voice: 'requires existing STT/TTS gateway wiring',
        modelConfigured: Boolean(this.modelGateway()),
      },
    };
    const input = request.input;
    const model = this.modelGateway();
    const port: TranslationPort | undefined = model ? {
      location: this.processingLocation,
      translate: async (translation) => {
        const messages = contextualTranslationMessages(translation);
        const response = await model.complete({
          messages: [{ role: 'system', content: messages.system }, { role: 'user', content: messages.user }],
          temperature: 0,
          responseFormat: 'json',
        });
        return { text: parseTranslationResponse(response.text), provider: response.provider, model: response.model };
      },
    } : undefined;
    try {
      await onProgress({ phase: 'progress', message: 'Interpreter: interpreting a text turn', percent: 30 });
      const result = await interpretText({
        consumer: typeof input.consumer === 'string' ? input.consumer : 'janus',
        text: String(input.text ?? ''),
        sourceLanguage: String(input.sourceLanguage ?? ''),
        targetLanguage: String(input.targetLanguage ?? ''),
        ...(typeof input.speakerId === 'string' ? { speakerId: input.speakerId } : {}),
        ...(input.context && typeof input.context === 'object' && !Array.isArray(input.context)
          ? { context: input.context as InterpreterContext } : {}),
        allowExternalProcessing: input.allowExternalProcessing === true,
      }, port);
      return { ok: true, output: { ...result, reply: result.translatedText } };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof InterpreterError ? `${error.code}: ${error.message}` :
          error instanceof Error ? error.message : String(error),
      };
    }
  }
}
