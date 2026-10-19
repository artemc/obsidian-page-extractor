// gemini-service.ts
import { App, Notice } from 'obsidian';
import { AIResponse } from './types';
import { BaseAIService } from './base-ai-service';

export class GeminiService extends BaseAIService {
    constructor(
        app: App,
        private apiKey: string,
        private model: string,
        promptFile: string,
        fallbackPrompt: string,
    ) {
        super(app, promptFile, fallbackPrompt);
    }

    async analyzeText(text: string): Promise<{ aiResponse: AIResponse | null; debugInfo: Record<string, unknown> }> {
        if (!this.apiKey) {
            new Notice('Gemini API key is not set. Please configure it in the plugin settings.');
            return { aiResponse: null, debugInfo: {} };
        }

        new Notice('Communicating with Gemini...');
        
        const timeSent = new Date();
        const debugInfo: Record<string, unknown> = {
            timeSent: timeSent.toISOString(),
            model: this.model,
        };

        try {
            const prompt = await this.getPrompt();
            const fullPrompt = `${prompt}\n\nText to analyze:\n${text}`;

            const requestBody = {
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }]
            };
            
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

            debugInfo.request = {
                url: apiUrl,
                body: requestBody,
            };

            const response = await fetch(`${apiUrl}?key=${this.apiKey}`, {
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
                const errorData = await response.json();
                console.error('Gemini API error:', errorData);
                debugInfo.response = errorData;
                throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData?.error?.message}`);
            }

            const data = await response.json();
            debugInfo.response = data;

            // Extract token counts if available
            if (data.usageMetadata) {
                debugInfo.inputTokens = data.usageMetadata.promptTokenCount;
                debugInfo.outputTokens = data.usageMetadata.candidatesTokenCount;
            }

            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!responseText) {
                console.error('Invalid response structure from Gemini:', data);
                throw new Error('Invalid response structure from Gemini.');
            }

            try {
                const extractedJson = this.extractJsonFromResponse(responseText);
                const aiResponse = this.parseJsonSafely(extractedJson);
                return { aiResponse, debugInfo };
            } catch (parseError) {
                const message = parseError instanceof Error ? parseError.message : String(parseError);
                console.error('Failed to parse Gemini response as JSON:', message);
                console.error('Original response text:', responseText);
                new Notice('Gemini response could not be parsed. Check console for details.');
                return { aiResponse: null, debugInfo };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Gemini analysis failed:', message);
            new Notice(`Gemini analysis failed: ${message}`);
            return { aiResponse: null, debugInfo };
        }
    }

    /**
     * Update the API key at runtime (resolved from SecretStorage).
     */
    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
    }

    updateSettings(apiKey: string, model: string, promptFile: string, fallbackPrompt: string) {
        this.apiKey = apiKey;
        this.model = model;
        this.promptFile = promptFile;
        this.fallbackPrompt = fallbackPrompt;
    }
}
