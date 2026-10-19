// ollama-service.ts
import { App, Notice } from 'obsidian';
import { AIResponse } from './types';
import { BaseAIService } from './base-ai-service';

export class OllamaService extends BaseAIService {
    constructor(
        app: App,
        private ollamaUrl: string,
        private model: string,
        promptFile: string,
        fallbackPrompt: string
    ) {
        super(app, promptFile, fallbackPrompt);
    }

    async analyzeText(text: string): Promise<{ aiResponse: AIResponse | null; debugInfo: Record<string, unknown> }> {
        const timeSent = new Date();
        const debugInfo: Record<string, unknown> = {
            timeSent: timeSent.toISOString(),
            model: this.model,
        };

        try {
            const prompt = await this.getPrompt();
            
            const requestBody = {
                model: this.model,
                prompt: `${prompt}\n\nText to analyze:\n${text}`,
                stream: false
            };
            
            debugInfo.request = {
                url: `${this.ollamaUrl}/api/generate`,
                body: requestBody,
            };

            const response = await fetch(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const timeReceived = new Date();
            debugInfo.timeReceived = timeReceived.toISOString();
            debugInfo.responseTime = timeReceived.getTime() - timeSent.getTime();

            if (!response.ok) {
                debugInfo.response = await response.text();
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            debugInfo.response = data;

            // Extract token counts if available
            debugInfo.inputTokens = data.prompt_eval_count;
            debugInfo.outputTokens = data.eval_count;
            
            // Extract and parse JSON from the AI response
            try {
                const extractedJson = this.extractJsonFromResponse(data.response);
                const aiResponse = this.parseJsonSafely(extractedJson);
                return { aiResponse, debugInfo };
                
            } catch (parseError) {
                const message = parseError instanceof Error ? parseError.message : String(parseError);
                console.error('Failed to parse AI response as JSON:', message);
                console.error('Original response:', data.response);
                new Notice('AI response could not be parsed. Check console for details.');
                return { aiResponse: null, debugInfo };
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('AI analysis failed:', message);
            new Notice(`AI analysis failed: ${message}`);
            return { aiResponse: null, debugInfo };
        }
    }

    updateSettings(ollamaUrl: string, model: string, promptFile: string, fallbackPrompt: string) {
        this.ollamaUrl = ollamaUrl;
        this.model = model;
        this.promptFile = promptFile;
        this.fallbackPrompt = fallbackPrompt;
    }
}