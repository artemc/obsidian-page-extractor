import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import PageExtractorPlugin from './main';
import { PageExtractorSettings } from './types';

export class PageExtractorSettingTab extends PluginSettingTab {
    plugin: PageExtractorPlugin;

    constructor(app: App, plugin: PageExtractorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Persist through the plugin so handlers and the ribbon icon pick up the change,
     * then re-evaluate visibility of provider-specific settings.
     */
    async setControlValue(key: string, value: unknown): Promise<void> {
        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
        await this.plugin.saveSettings();
        if (key === 'aiEnabled' || key === 'aiProvider' || key === 'agentName') {
            this.update();
        }
    }

    getSettingDefinitions(): SettingDefinitionItem<keyof PageExtractorSettings>[] {
        const settings = this.plugin.settings;
        const aiVisible = () => settings.aiEnabled;
        const agentVisible = () => settings.aiEnabled && settings.aiProvider === 'agent';
        const piVisible = () => agentVisible() && settings.agentName === 'pi';
        const claudeVisible = () => agentVisible() && settings.agentName === 'claude';

        return [
            {
                type: 'group',
                items: [
                    {
                        name: 'Default extraction mode',
                        desc: 'Choose whether extracted text goes to a new note or current note by default',
                        control: {
                            type: 'dropdown',
                            key: 'defaultExtractionMode',
                            options: {
                                'new-note': 'Create new note',
                                'current-note': 'Append to current note',
                            },
                        },
                    },
                    {
                        name: 'Note name template',
                        desc: 'Template for new note names. Use {{date}}, {{time}}, {{pdf}}, {{page}} as placeholders',
                        control: { type: 'text', key: 'noteNameTemplate', placeholder: '{{pdf}} - Page {{page}}' },
                    },
                    {
                        name: 'Note folder',
                        desc: 'Folder to save extracted notes (leave empty for vault root)',
                        control: { type: 'folder', key: 'noteFolder', placeholder: 'Extracted Notes' },
                    },
                    {
                        name: 'Include page number',
                        desc: 'Include page number in extracted note metadata',
                        control: { type: 'toggle', key: 'includePageNumber' },
                    },
                    {
                        name: 'Include source PDF name',
                        desc: 'Include source PDF name in extracted note metadata',
                        control: { type: 'toggle', key: 'includeSourcePdfName' },
                    },
                    {
                        name: 'Open to the right',
                        desc: 'Open new extracted notes in a split pane to the right instead of the current pane',
                        control: { type: 'toggle', key: 'openToTheRight' },
                    },
                    {
                        name: 'Append to rightmost note',
                        desc: 'When extracting to current note, append to the rightmost note instead of the currently active one',
                        control: { type: 'toggle', key: 'appendToRightmostNote' },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'AI analysis',
                items: [
                    {
                        name: 'Enable AI analysis',
                        desc: 'Enable AI analysis features.',
                        control: { type: 'toggle', key: 'aiEnabled' },
                    },
                    {
                        name: 'AI provider',
                        desc: 'Choose the AI provider for analysis.',
                        visible: aiVisible,
                        control: {
                            type: 'dropdown',
                            key: 'aiProvider',
                            options: { ollama: 'Ollama', gemini: 'Gemini', agent: 'Command-line agent (SSH)' },
                        },
                    },
                    {
                        name: 'Ollama URL',
                        desc: 'URL of your Ollama instance.',
                        visible: () => settings.aiEnabled && settings.aiProvider === 'ollama',
                        control: { type: 'text', key: 'ollamaUrl', placeholder: 'http://localhost:11434' },
                    },
                    {
                        name: 'Ollama model',
                        desc: 'Name of the Ollama model to use.',
                        visible: () => settings.aiEnabled && settings.aiProvider === 'ollama',
                        control: { type: 'text', key: 'ollamaModel', placeholder: 'llama2' },
                    },
                    {
                        name: 'Gemini API key',
                        desc: 'Select a secret from Obsidian secret storage for your Google AI API key.',
                        visible: () => settings.aiEnabled && settings.aiProvider === 'gemini',
                        control: { type: 'secret', key: 'geminiApiKeyName' },
                    },
                    {
                        name: 'Gemini model',
                        desc: 'Name of the Gemini model to use.',
                        visible: () => settings.aiEnabled && settings.aiProvider === 'gemini',
                        control: { type: 'text', key: 'geminiModel', placeholder: 'gemini-1.5-flash' },
                    },
                    {
                        name: 'Agent host',
                        desc: 'SSH host that runs the agent, as you would pass it to ssh (e.g. a Host alias from ~/.ssh/config). Key-based login is required: password prompts are disabled. Leave empty to run the agent on this computer.',
                        visible: agentVisible,
                        control: { type: 'text', key: 'agentHost', placeholder: 'myserver' },
                    },
                    {
                        name: 'Agent',
                        desc: 'Command-line agent to run. The prompt and note text are sent to its standard input; the agent runs with all tools disabled in a temporary empty directory.',
                        visible: agentVisible,
                        control: {
                            type: 'dropdown',
                            key: 'agentName',
                            options: { pi: 'pi', claude: 'Claude Code' },
                        },
                    },
                    {
                        name: 'Agent timeout',
                        desc: 'Seconds to wait for the answer before the agent is stopped.',
                        visible: agentVisible,
                        control: { type: 'number', key: 'agentTimeoutSeconds', min: 10, step: 1 },
                    },
                    {
                        name: 'Pi executable',
                        desc: 'Path to pi on the agent host. A non-interactive SSH session may not have it on PATH, so an absolute path or ~/ is safer.',
                        visible: piVisible,
                        control: { type: 'text', key: 'piPath', placeholder: '~/.local/bin/pi' },
                    },
                    {
                        name: 'Pi provider',
                        desc: 'Value of --provider. Leave empty for the pi default.',
                        visible: piVisible,
                        control: { type: 'text', key: 'piProvider', placeholder: 'openai-codex' },
                    },
                    {
                        name: 'Pi model',
                        desc: 'Value of --model. Run "pi --list-models" on the host to see the options. Leave empty for the pi default.',
                        visible: piVisible,
                        control: { type: 'text', key: 'piModel', placeholder: 'gpt-5.6-luna' },
                    },
                    {
                        name: 'Pi thinking level',
                        desc: 'Value of --thinking.',
                        visible: piVisible,
                        control: {
                            type: 'dropdown',
                            key: 'piThinking',
                            options: {
                                '': 'Default',
                                off: 'Off',
                                minimal: 'Minimal',
                                low: 'Low',
                                medium: 'Medium',
                                high: 'High',
                                xhigh: 'Extra high',
                                max: 'Max',
                            },
                        },
                    },
                    {
                        name: 'Claude Code executable',
                        desc: 'Path to claude on the agent host. A non-interactive SSH session may not have it on PATH, so an absolute path or ~/ is safer.',
                        visible: claudeVisible,
                        control: { type: 'text', key: 'claudePath', placeholder: '~/.local/bin/claude' },
                    },
                    {
                        name: 'Claude Code model',
                        desc: 'Value of --model: an alias such as "sonnet" or "haiku", or a full model name. Leave empty for the default.',
                        visible: claudeVisible,
                        control: { type: 'text', key: 'claudeModel', placeholder: 'sonnet' },
                    },
                    {
                        name: 'Claude Code effort',
                        desc: 'Value of --effort.',
                        visible: claudeVisible,
                        control: {
                            type: 'dropdown',
                            key: 'claudeEffort',
                            options: {
                                '': 'Default',
                                low: 'Low',
                                medium: 'Medium',
                                high: 'High',
                                xhigh: 'Extra high',
                                max: 'Max',
                            },
                        },
                    },
                    {
                        name: 'AI prompt file',
                        desc: 'Markdown file with the AI prompt (e.g., prompts/ai-analyze.md). It is read fresh on each run. If empty or not found, the fallback prompt below is used.',
                        visible: aiVisible,
                        control: {
                            type: 'file',
                            key: 'aiPromptFile',
                            placeholder: 'prompts/ai-analyze.md',
                            filter: file => file.extension === 'md',
                        },
                    },
                    {
                        name: 'Fallback AI prompt',
                        desc: 'Used when the prompt file is not set or not found. The model should respond with JSON containing frontmatter, note_name, and note_text (all optional). AI content is prepended to existing content.',
                        visible: aiVisible,
                        control: {
                            type: 'textarea',
                            key: 'aiPrompt',
                            placeholder: 'Analyze the following text and provide a structured summary...',
                        },
                    },
                    {
                        name: 'Link fields',
                        desc: 'Comma-separated frontmatter fields whose values are written as wikilinks, e.g. "[[Value]]".',
                        visible: aiVisible,
                        control: { type: 'text', key: 'aiLinkFields', placeholder: 'author, people' },
                    },
                    {
                        name: 'Quoted fields',
                        desc: 'Comma-separated frontmatter fields whose values are always written as quoted strings (useful for IDs and numbers).',
                        visible: aiVisible,
                        control: { type: 'text', key: 'aiQuotedFields', placeholder: 'id, number' },
                    },
                    {
                        name: 'Debug mode',
                        desc: 'Add the raw request, response, and timing details to the note in a collapsed callout.',
                        visible: aiVisible,
                        control: { type: 'toggle', key: 'aiDebugMode' },
                    },
                ],
            },
        ];
    }
}
