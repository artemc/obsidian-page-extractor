import { TFile } from 'obsidian';

export type AIProvider = 'ollama' | 'gemini' | 'agent';
export type AgentName = 'pi' | 'claude';

export interface PageExtractorSettings {
    defaultExtractionMode: 'new-note' | 'current-note';
    noteNameTemplate: string;
    noteFolder: string;
    includePageNumber: boolean;
    includeSourcePdfName: boolean;
    openToTheRight: boolean;
    appendToRightmostNote: boolean;
    // AI Settings
    aiEnabled: boolean;
    aiProvider: AIProvider;
    ollamaUrl: string;
    ollamaModel: string;
    geminiApiKeyName: string;
    geminiModel: string;
    // Command-line agent run over SSH (or locally when the host is empty)
    agentHost: string;
    agentName: AgentName;
    agentTimeoutSeconds: number;
    piPath: string;
    piProvider: string;
    piModel: string;
    piThinking: string;
    claudePath: string;
    claudeModel: string;
    claudeEffort: string;
    aiPromptFile: string;
    aiPrompt: string;
    aiLinkFields: string;
    aiQuotedFields: string;
    aiDebugMode: boolean;
}

export interface PdfInfo {
    file: TFile;
    path: string;
}

export interface PdfPageInfo extends PdfInfo {
    pageNumber: number;
}

export interface AIResponse {
    frontmatter?: Record<string, unknown>;
    note_name?: string;
    note_text?: string;
}
