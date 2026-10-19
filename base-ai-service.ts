// base-ai-service.ts
import { App, TFile } from 'obsidian';
import { AIResponse } from './types';

export abstract class BaseAIService {
    constructor(
        protected app: App,
        protected promptFile: string,
        protected fallbackPrompt: string
    ) {}

    protected async getPrompt(): Promise<string> {
        if (this.promptFile && this.promptFile.trim()) {
            try {
                const file = this.app.vault.getAbstractFileByPath(this.promptFile);
                if (file && file instanceof TFile) {
                    const promptContent = await this.app.vault.read(file);
                    if (promptContent.trim()) {
                        return promptContent.trim();
                    }
                }
            } catch (error) {
                console.warn('Failed to read prompt file, using fallback:', error);
            }
        }
        return this.fallbackPrompt;
    }

    protected cleanJsonString(jsonString: string): string {
        const cleaned = jsonString
            // Remove trailing commas before closing braces
            .replace(/,(\s*})/g, '$1')
            // Remove trailing commas before closing brackets
            .replace(/,(\s*])/g, '$1')
            // Remove comments (both // and /* */)
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Fix common quote issues - ensure all keys are double-quoted
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            // Fix single quotes to double quotes for strings
            .replace(/'([^']*)'/g, '"$1"')
            // Remove extra whitespace
            .trim();

        return cleaned;
    }

    protected parseJsonSafely(jsonString: string): AIResponse {
        const attempts: (() => AIResponse)[] = [
            // First attempt: try parsing as-is
            () => JSON.parse(jsonString),
            
            // Second attempt: clean common issues and parse
            () => JSON.parse(this.cleanJsonString(jsonString)),
            
            // Third attempt: try to extract just the object content and wrap it properly
            () => {
                const objectMatch = jsonString.match(/\{([\s\S]*)\}/);
                if (objectMatch) {
                    const objectContent = objectMatch[1];
                    const cleaned = this.cleanJsonString(`{${objectContent}}`);
                    return JSON.parse(cleaned);
                }
                throw new Error('No object found');
            },
            
            // Fourth attempt: try to manually construct a valid JSON
            () => {
                const lines = jsonString.split('\n');
                const validLines: string[] = [];
                let inObject = false;
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === '{') {
                        inObject = true;
                        validLines.push(trimmed);
                    } else if (trimmed === '}') {
                        inObject = false;
                        validLines.push(trimmed);
                    } else if (inObject && trimmed) {
                        let cleanedLine = trimmed;
                        
                        if (cleanedLine.endsWith(',')) {
                            const nextNonEmptyIndex = lines.findIndex((l, i) => 
                                i > lines.indexOf(line) && l.trim() && l.trim() !== '}'
                            );
                            if (nextNonEmptyIndex === -1) {
                                cleanedLine = cleanedLine.slice(0, -1);
                            }
                        }
                        
                        if (cleanedLine.includes(':') && !cleanedLine.match(/^"[^"]*":/)) {
                            cleanedLine = cleanedLine.replace(/^([a-zA-Z_][a-zA-Z0-9_]*):/, '"$1":');
                        }
                        
                        validLines.push(cleanedLine);
                    }
                }
                
                const reconstructed = validLines.join('\n');
                return JSON.parse(reconstructed);
            }
        ];

        for (let i = 0; i < attempts.length; i++) {
            try {
                const result = attempts[i]();
                if (i > 0) {
                    console.log(`JSON parsing succeeded on attempt ${i + 1}`);
                }
                return result;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`JSON parsing attempt ${i + 1} failed:`, message);
                if (i === attempts.length - 1) {
                    throw error;
                }
            }
        }

        // This should never be reached, but TypeScript needs it
        throw new Error('All JSON parsing attempts failed');
    }

    protected extractJsonFromResponse(responseText: string): string {
        // First, try to extract JSON from markdown code blocks
        const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i;
        const codeBlockMatch = responseText.match(codeBlockRegex);
        
        if (codeBlockMatch && codeBlockMatch[1]) {
            return codeBlockMatch[1].trim();
        }
        
        // If no code block found, try to find JSON-like content starting with {
        const jsonRegex = /(\{[\s\S]*\})/;
        const jsonMatch = responseText.match(jsonRegex);
        
        if (jsonMatch && jsonMatch[1]) {
            return jsonMatch[1].trim();
        }
        
        // Return the original response if no patterns match
        return responseText.trim();
    }

    abstract analyzeText(text: string): Promise<{ aiResponse: AIResponse | null; debugInfo: Record<string, unknown> }>;
}
