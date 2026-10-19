import { PageExtractorSettings } from './types';

export const DEFAULT_SETTINGS: PageExtractorSettings = {
    defaultExtractionMode: 'new-note',
    noteNameTemplate: '{{pdf}} - Page {{page}}',
    noteFolder: '',
    includePageNumber: true,
    includeSourcePdfName: true,
    openToTheRight: true,
    appendToRightmostNote: false,
    // AI Settings
    aiEnabled: false,
    aiProvider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma3:12b',
    geminiApiKeyName: '',
    geminiModel: 'gemini-flash-lite-latest',
    aiPromptFile: '',
    aiPrompt: 'Analyze the following text and provide a structured response with frontmatter, note_name, and note_text fields in JSON format.',
    aiLinkFields: '',
    aiQuotedFields: '',
    aiDebugMode: false
};