// ai-service.ts
import { App } from 'obsidian';
import { AIResponse, PageExtractorSettings } from './types';
import { OllamaService } from './ollama-service';
import { GeminiService } from './gemini-service';

export class AIService {
    private settings: PageExtractorSettings;
    private ollamaService: OllamaService;
    private geminiService: GeminiService;

    constructor(
        private app: App,
        settings: PageExtractorSettings
    ) {
        this.settings = settings;
        this.ollamaService = new OllamaService(
            this.app,
            this.settings.ollamaUrl,
            this.settings.ollamaModel,
            this.settings.aiPromptFile,
            this.settings.aiPrompt
        );
        this.geminiService = new GeminiService(
            this.app,
            '', // API key will be resolved from SecretStorage at analysis time
            this.settings.geminiModel,
            this.settings.aiPromptFile,
            this.settings.aiPrompt
        );
    }

    private getActiveService(): OllamaService | GeminiService {
        if (this.settings.aiProvider === 'gemini') {
            return this.geminiService;
        }
        return this.ollamaService;
    }

    /**
     * Resolve the Gemini API key from Obsidian SecretStorage using the stored secret name.
     */
    private resolveGeminiApiKey(): string {
        const secretName = this.settings.geminiApiKeyName;
        if (!secretName) return '';
        return this.app.secretStorage.getSecret(secretName) ?? '';
    }

    async analyzeText(text: string): Promise<{ aiResponse: AIResponse | null; debugInfo: Record<string, unknown> }> {
        // If using Gemini, resolve the API key from SecretStorage before each call
        if (this.settings.aiProvider === 'gemini') {
            const resolvedKey = this.resolveGeminiApiKey();
            this.geminiService.updateApiKey(resolvedKey);
        }

        const activeService = this.getActiveService();
        return activeService.analyzeText(text);
    }

    updateSettings(settings: PageExtractorSettings) {
        this.settings = settings;
        this.ollamaService.updateSettings(
            settings.ollamaUrl,
            settings.ollamaModel,
            settings.aiPromptFile,
            settings.aiPrompt
        );
        this.geminiService.updateSettings(
            '', // API key resolved at analysis time, not stored here
            settings.geminiModel,
            settings.aiPromptFile,
            settings.aiPrompt
        );
    }
}
