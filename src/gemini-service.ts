// gemini-service.ts
import { App, Notice, requestUrl } from 'obsidian';
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

            const response = await requestUrl({
                url: apiUrl,
                method: 'POST',
                contentType: 'application/json',
                headers: { 'x-goog-api-key': this.apiKey },
                body: JSON.stringify(requestBody),
                throw: false,
            });

            const timeReceived = new Date();
            debugInfo.timeReceived = timeReceived.toISOString();
            debugInfo.responseTime = timeReceived.getTime() - timeSent.getTime();

            if (response.status >= 400) {
                let errorMessage = response.text;
                try {
                    const errorData = response.json as GeminiErrorResponse;
                    debugInfo.response = errorData;
                    errorMessage = errorData.error?.message ?? errorMessage;
                } catch {
                    debugInfo.response = response.text;
                }
                throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
            }

            const data = response.json as GeminiGenerateResponse;
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

interface GeminiErrorResponse {
    error?: { message?: string };
}

interface GeminiGenerateResponse {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
