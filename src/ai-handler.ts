// ai-handler.ts
import { App, MarkdownView, Notice, TFile } from 'obsidian';
import { AIService } from './ai-service';
import { PageExtractorSettings, AIResponse } from './types';

export class AIHandler {
    private aiService: AIService;

    constructor(
        private app: App,
        private settings: PageExtractorSettings
    ) {
        this.aiService = new AIService(this.app, this.settings);
    }

    async analyzeCurrentNote(): Promise<void> {
        if (!this.settings.aiEnabled) {
            new Notice('AI analysis is disabled. Enable it in plugin settings.');
            return;
        }

        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active note to analyze');
            return;
        }

        let file = activeView.file;
        if (!file) {
            new Notice('No active file found');
            return;
        }

        try {
            // Get the current note content
            const noteContent = await this.app.vault.read(file);
            
            // Remove existing frontmatter for analysis
            const contentWithoutFrontmatter = this.removeFrontmatter(noteContent);
            
            if (!contentWithoutFrontmatter.trim()) {
                new Notice('No content to analyze');
                return;
            }

            new Notice('Analyzing note with AI...');

            // Send to AI for analysis
            const { aiResponse, debugInfo } = await this.aiService.analyzeText(contentWithoutFrontmatter);
            
            if (!aiResponse) {
                // Error is already shown in the service
                if (this.settings.aiDebugMode && debugInfo) {
                    await this.appendDebugInfo(file, debugInfo);
                }
                return;
            }

            // Apply the AI response to the note
            // This might rename the file, so we get the new file reference
            const newFile = await this.applyAIResponse(file, aiResponse, noteContent);
            file = newFile;

            // If debug mode is on, append the debug info
            if (this.settings.aiDebugMode && debugInfo) {
                await this.appendDebugInfo(file, debugInfo);
            }

            new Notice('AI analysis completed successfully');

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error during AI analysis:', error);
            new Notice(`AI analysis failed: ${message}`);
        }
    }

    private async appendDebugInfo(file: TFile, debugInfo: Record<string, unknown>): Promise<void> {
        const debugContent = `
---
> [!NOTE]- Debug Info
> - Time Sent: ${String(debugInfo.timeSent)}
> - Time Received: ${String(debugInfo.timeReceived)}
> - Response Time: ${String(debugInfo.responseTime)}ms
> - Model: ${String(debugInfo.model)}
> - Input Tokens: ${typeof debugInfo.inputTokens === 'number' ? debugInfo.inputTokens : 'N/A'}
> - Output Tokens: ${typeof debugInfo.outputTokens === 'number' ? debugInfo.outputTokens : 'N/A'}
>
>> [!NOTE]- Raw request
>> \`\`\`json
>> ${(JSON.stringify(debugInfo.request, null, 2) || 'N/A').replace(/\n/g, '\n>> ')}
>> \`\`\`
>
>> [!NOTE]- Raw response
>> \`\`\`json
>> ${(JSON.stringify(debugInfo.response, null, 2) || 'N/A').replace(/\n/g, '\n>> ')}
>> \`\`\`
`;
        const currentContent = await this.app.vault.read(file);
        await this.app.vault.modify(file, currentContent + '\n' + debugContent);
    }

    private removeFrontmatter(content: string): string {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        return content.replace(frontmatterRegex, '').trim();
    }

    private parseFrontmatter(frontmatterText: string): Record<string, unknown> {
        const frontmatter: Record<string, unknown> = {};
        if (!frontmatterText.trim()) {
            return frontmatter;
        }

        const lines = frontmatterText.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && trimmedLine.includes(':')) {
                const colonIndex = trimmedLine.indexOf(':');
                const key = trimmedLine.substring(0, colonIndex).trim();
                const value = trimmedLine.substring(colonIndex + 1).trim();
                
                if (key) {
                    // Try to parse the value (remove quotes if present)
                    let parsedValue: unknown = value;
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                        parsedValue = value.slice(1, -1);
                    }
                    
                    // Handle arrays (basic parsing for tags)
                    if (value.startsWith('[') && value.endsWith(']')) {
                        try {
                            parsedValue = JSON.parse(value);
                        } catch {
                            parsedValue = value;
                        }
                    }
                    
                    frontmatter[key] = parsedValue;
                }
            }
        }
        
        return frontmatter;
    }

    private parseFieldList(list: string): string[] {
        return list.split(',').map(field => field.trim()).filter(Boolean);
    }

    private formatFrontmatterValue(value: unknown, key: string): string {
        if (this.parseFieldList(this.settings.aiLinkFields).includes(key) && value) {
            if (Array.isArray(value)) {
                const a = value.map(item => `"[[${toYamlText(item)}]]"`);
                return `[${a.join(', ')}]`;
            }
            return `"[[${toYamlText(value)}]]"`;
        }

        if (this.parseFieldList(this.settings.aiQuotedFields).includes(key)) {
            return `"${toYamlText(value)}"`;
        }

        if (Array.isArray(value)) {
            return JSON.stringify(value);
        }
        if (typeof value === 'string' && (value.includes(':') || value.includes(',') || value.includes('#'))) {
            return `"${value}"`;
        }
        return toYamlText(value);
    }

    private async applyAIResponse(file: TFile, aiResponse: AIResponse, originalContent: string): Promise<TFile> {
        try {
            // Extract original frontmatter
            const frontmatterMatch = originalContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
            let existingFrontmatterObj: Record<string, unknown> = {};
            
            if (frontmatterMatch && frontmatterMatch[1]) {
                existingFrontmatterObj = this.parseFrontmatter(frontmatterMatch[1]);
            }
            
            // Get content without frontmatter
            const contentWithoutFrontmatter = this.removeFrontmatter(originalContent);
            
            // Merge frontmatter with AI frontmatter taking precedence
            let mergedFrontmatter: Record<string, unknown> = { ...existingFrontmatterObj };
            
            if (aiResponse.frontmatter) {
                // AI frontmatter overrides existing frontmatter (removes duplicates)
                mergedFrontmatter = { ...existingFrontmatterObj, ...aiResponse.frontmatter };
            }
            
            // Format frontmatter for output
            let newFrontmatterContent = '';
            if (Object.keys(mergedFrontmatter).length > 0) {
                const frontmatterEntries = Object.entries(mergedFrontmatter)
                    .map(([key, value]) => `${key}: ${this.formatFrontmatterValue(value, key)}`)
                    .join('\n');
                newFrontmatterContent = frontmatterEntries;
            }
            
            // Prepare new content (prepend mode - AI content before existing content)
            let newBodyContent = contentWithoutFrontmatter;
            if (aiResponse.note_text) {
                const aiText = aiResponse.note_text.trim();
                if (aiText) {
                    if (contentWithoutFrontmatter.trim()) {
                        newBodyContent = `${aiText}\n\n${contentWithoutFrontmatter}`;
                    } else {
                        newBodyContent = aiText;
                    }
                }
            }
            
            // Combine frontmatter and content
            let finalContent = '';
            if (newFrontmatterContent.trim()) {
                finalContent = `---\n${newFrontmatterContent}\n---\n\n${newBodyContent}`;
            } else {
                finalContent = newBodyContent;
            }
            
            // Update the file content
            await this.app.vault.modify(file, finalContent);
            
            // Rename the file if needed
            if (aiResponse.note_name && aiResponse.note_name !== file.basename) {
                const newFileName = this.sanitizeFileName(aiResponse.note_name);
                const newPath = file.parent ? `${file.parent.path}/${newFileName}.md` : `${newFileName}.md`;
                
                // Check if file with new name already exists
                const existingFile = this.app.vault.getAbstractFileByPath(newPath);
                if (existingFile) {
                    new Notice(`File with name "${newFileName}" already exists. Content updated but not renamed.`);
                    return file;
                } else {
                    await this.app.vault.rename(file, newPath);
                    // Return the new file object
                    const newFile = this.app.vault.getAbstractFileByPath(newPath);
                    return newFile instanceof TFile ? newFile : file;
                }
            }
            return file;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error applying AI response:', error);
            new Notice(`Failed to apply AI analysis: ${message}`);
            return file;
        }
    }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[<>:"/\\|?*]/g, '-').trim();
    }

    updateSettings(settings: PageExtractorSettings) {
        this.settings = settings;
        this.aiService.updateSettings(settings);
    }
}

function toYamlText(value: unknown): string {
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}
