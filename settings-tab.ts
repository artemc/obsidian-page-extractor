import { App, PluginSettingTab, SecretComponent, Setting } from 'obsidian';
import PageExtractorPlugin from './main';

export class PageExtractorSettingTab extends PluginSettingTab {
    plugin: PageExtractorPlugin;
    private saveTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

    constructor(app: App, plugin: PageExtractorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Debounced save for text fields — waits 500ms after last keystroke before saving.
     */
    private debouncedSave(key: string) {
        const existing = this.saveTimeouts.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        const timeout = setTimeout(async () => {
            this.saveTimeouts.delete(key);
            await this.plugin.saveSettings();
        }, 500);
        this.saveTimeouts.set(key, timeout);
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Page Extractor Settings' });

        new Setting(containerEl)
            .setName('Default extraction mode')
            .setDesc('Choose whether extracted text goes to a new note or current note by default')
            .addDropdown(dropdown => dropdown
                .addOption('new-note', 'Create new note')
                .addOption('current-note', 'Append to current note')
                .setValue(this.plugin.settings.defaultExtractionMode)
                .onChange(async (value: 'new-note' | 'current-note') => {
                    this.plugin.settings.defaultExtractionMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Note name template')
            .setDesc('Template for new note names. Use {{date}}, {{time}}, {{pdf}}, {{page}} as placeholders')
            .addText(text => text
                .setPlaceholder('{{pdf}} - Page {{page}}')
                .setValue(this.plugin.settings.noteNameTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.noteNameTemplate = value;
                    this.debouncedSave('noteNameTemplate');
                }));

        new Setting(containerEl)
            .setName('Note folder')
            .setDesc('Folder to save extracted notes (leave empty for vault root)')
            .addText(text => text
                .setPlaceholder('Extracted Notes')
                .setValue(this.plugin.settings.noteFolder)
                .onChange(async (value) => {
                    this.plugin.settings.noteFolder = value;
                    this.debouncedSave('noteFolder');
                }));

        new Setting(containerEl)
            .setName('Include page number')
            .setDesc('Include page number in extracted note metadata')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includePageNumber)
                .onChange(async (value) => {
                    this.plugin.settings.includePageNumber = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include source PDF name')
            .setDesc('Include source PDF name in extracted note metadata')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeSourcePdfName)
                .onChange(async (value) => {
                    this.plugin.settings.includeSourcePdfName = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Open to the right')
            .setDesc('Open new extracted notes in a split pane to the right instead of the current pane')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openToTheRight)
                .onChange(async (value) => {
                    this.plugin.settings.openToTheRight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Append to rightmost note')
            .setDesc('When extracting to current note, append to the rightmost note instead of the currently active one')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.appendToRightmostNote)
                .onChange(async (value) => {
                    this.plugin.settings.appendToRightmostNote = value;
                    await this.plugin.saveSettings();
                }));

        // AI Settings Section
        containerEl.createEl('h3', { text: 'AI Analysis Settings' });

        new Setting(containerEl)
            .setName('Enable AI analysis')
            .setDesc('Enable AI analysis features.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.aiEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.aiEnabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide AI settings
                }));

        if (this.plugin.settings.aiEnabled) {
            new Setting(containerEl)
                .setName('AI Provider')
                .setDesc('Choose the AI provider for analysis.')
                .addDropdown(dropdown => dropdown
                    .addOption('ollama', 'Ollama')
                    .addOption('gemini', 'Gemini')
                    .setValue(this.plugin.settings.aiProvider)
                    .onChange(async (value: 'ollama' | 'gemini') => {
                        this.plugin.settings.aiProvider = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show provider-specific settings
                    }));

            // Ollama-specific settings
            if (this.plugin.settings.aiProvider === 'ollama') {
                new Setting(containerEl)
                    .setName('Ollama URL')
                    .setDesc('URL for your Ollama instance.')
                    .addText(text => text
                        .setPlaceholder('http://localhost:11434')
                        .setValue(this.plugin.settings.ollamaUrl)
                        .onChange(async (value) => {
                            this.plugin.settings.ollamaUrl = value;
                            this.debouncedSave('ollamaUrl');
                        }));

                new Setting(containerEl)
                    .setName('Ollama Model')
                    .setDesc('Name of the Ollama model to use.')
                    .addText(text => text
                        .setPlaceholder('llama2')
                        .setValue(this.plugin.settings.ollamaModel)
                        .onChange(async (value) => {
                            this.plugin.settings.ollamaModel = value;
                            this.debouncedSave('ollamaModel');
                        }));
            }

            // Gemini-specific settings
            if (this.plugin.settings.aiProvider === 'gemini') {
                new Setting(containerEl)
                    .setName('Gemini API Key')
                    .setDesc('Select a secret from Obsidian SecretStorage for your Google AI API key.')
                    .addComponent(el => new SecretComponent(this.app, el)
                        .setValue(this.plugin.settings.geminiApiKeyName)
                        .onChange(value => {
                            this.plugin.settings.geminiApiKeyName = value;
                            this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Gemini Model')
                    .setDesc('Name of the Gemini model to use.')
                    .addText(text => text
                        .setPlaceholder('gemini-1.5-flash')
                        .setValue(this.plugin.settings.geminiModel)
                        .onChange(async (value) => {
                            this.plugin.settings.geminiModel = value;
                            this.debouncedSave('geminiModel');
                        }));
            }

            // Common AI settings
            new Setting(containerEl)
                .setName('AI Prompt File')
                .setDesc('Path to MD file containing the AI prompt (e.g., prompts/ai-analyze.md). If empty or file not found, fallback prompt below will be used.')
                .addText(text => text
                    .setPlaceholder('prompts/ai-analyze.md')
                    .setValue(this.plugin.settings.aiPromptFile)
                    .onChange(async (value) => {
                        this.plugin.settings.aiPromptFile = value;
                        this.debouncedSave('aiPromptFile');
                    }));

            new Setting(containerEl)
                .setName('Fallback AI Prompt')
                .setDesc('Fallback prompt used when prompt file is not specified or not found. The model should respond with JSON containing frontmatter, note_name, and note_text (all optional).')
                .addTextArea(text => text
                    .setPlaceholder('Analyze the following text and provide a structured summary...')
                    .setValue(this.plugin.settings.aiPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.aiPrompt = value;
                        this.debouncedSave('aiPrompt');
                    }));

            new Setting(containerEl)
                .setName('Link fields')
                .setDesc('Comma-separated frontmatter fields whose values are written as wikilinks, e.g. "[[Value]]".')
                .addText(text => text
                    .setPlaceholder('author, people')
                    .setValue(this.plugin.settings.aiLinkFields)
                    .onChange(async (value) => {
                        this.plugin.settings.aiLinkFields = value;
                        this.debouncedSave('aiLinkFields');
                    }));

            new Setting(containerEl)
                .setName('Quoted fields')
                .setDesc('Comma-separated frontmatter fields whose values are always written as quoted strings (useful for IDs and numbers).')
                .addText(text => text
                    .setPlaceholder('id, number')
                    .setValue(this.plugin.settings.aiQuotedFields)
                    .onChange(async (value) => {
                        this.plugin.settings.aiQuotedFields = value;
                        this.debouncedSave('aiQuotedFields');
                    }));

            new Setting(containerEl)
                .setName('Debug mode (add RAW data to a note)')
                .setDesc('If enabled, the raw request, response, and timing details will be added to the note in a collapsed callout for debugging.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.aiDebugMode)
                    .onChange(async (value) => {
                        this.plugin.settings.aiDebugMode = value;
                        await this.plugin.saveSettings();
                    }));

            containerEl.createEl('p', {
                text: 'Note: The prompt is loaded fresh from the file each time AI analysis runs. All response fields (frontmatter, note_name, note_text) are optional. AI content will be prepended to existing content.',
                cls: 'setting-item-description'
            });
        }
    }
}