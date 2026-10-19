import { EventRef, Menu, Plugin, TFile } from 'obsidian';
import { PageExtractorSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { MenuHandler } from './menu-handler';
import { PageExtractorSettingTab } from './settings-tab';
import { AIHandler } from './ai-handler';

// PDF++ adds a 'pdf-menu' workspace event that is not part of the Obsidian API.
interface PdfPlusWorkspace {
    on(name: 'pdf-menu', callback: (menu: Menu, data: { pageNumber: number; selection?: string }) => void): EventRef;
}

export default class PageExtractorPlugin extends Plugin {
    settings!: PageExtractorSettings;
    private menuHandler!: MenuHandler;
    private aiHandler!: AIHandler;
    private aiRibbonIcon: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();
        
        this.menuHandler = new MenuHandler(this.app, this.settings);
        this.aiHandler = new AIHandler(this.app, this.settings);

        // Add AI ribbon button if enabled
        this.updateAIRibbonIcon();

        // Register PDF++ context menu integration
        this.registerEvent(
            (this.app.workspace as unknown as PdfPlusWorkspace).on('pdf-menu', (menu, data) => {
                this.menuHandler.addPdfPageExtractMenuItems(menu, data);
            })
        );

        // Register context menu handler for PDF files
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file) => {
                if (file instanceof TFile && file.extension.toLowerCase() === 'pdf') {
                    this.menuHandler.addPdfFileContextMenuItems(menu, file);
                }
            })
        );

        // Add commands
        this.addCommand({
            id: 'extract-pdf-page-to-new-note',
            name: 'Extract current PDF page to new note',
            checkCallback: (checking: boolean) => {
                const pageInfo = this.menuHandler.getCurrentPdfPageInfo();
                if (pageInfo) {
                    if (!checking) void this.menuHandler.extractPdfPage(pageInfo, 'new-note');
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'extract-pdf-page-to-current-note',
            name: 'Extract current PDF page to current note',
            checkCallback: (checking: boolean) => {
                const pageInfo = this.menuHandler.getCurrentPdfPageInfo();
                if (pageInfo) {
                    if (!checking) void this.menuHandler.extractPdfPage(pageInfo, 'current-note');
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'extract-full-pdf-text',
            name: 'Extract full PDF text to new note',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile?.extension.toLowerCase() === 'pdf') {
                    if (!checking) void this.menuHandler.extractFullPdfText(activeFile);
                    return true;
                }
                return false;
            }
        });

        // Add AI analyze command
        this.addCommand({
            id: 'ai-analyze-note',
            name: 'AI analyze current note',
            checkCallback: (checking: boolean) => {
                if (this.settings.aiEnabled) {
                    if (!checking) {
                        void this.aiHandler.analyzeCurrentNote();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addSettingTab(new PageExtractorSettingTab(this.app, this));
    }

    onunload() {
        if (this.aiRibbonIcon) {
            this.aiRibbonIcon.remove();
            this.aiRibbonIcon = null;
        }
    }

    private updateAIRibbonIcon() {
        // Remove existing ribbon icon if present
        if (this.aiRibbonIcon) {
            this.aiRibbonIcon.remove();
            this.aiRibbonIcon = null;
        }

        // Add new ribbon icon if AI is enabled
        if (this.settings.aiEnabled) {
            this.aiRibbonIcon = this.addRibbonIcon('lightbulb', 'AI analyze', () => {
                void this.aiHandler.analyzeCurrentNote();
            });
        }
    }

    async loadSettings() {
        const savedData = ((await this.loadData()) ?? {}) as Partial<PageExtractorSettings> & { geminiApiKey?: unknown };
        const { geminiApiKey, ...rest } = savedData;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, rest);

        // Migration: move old plaintext geminiApiKey into SecretStorage
        if (typeof geminiApiKey === 'string' && geminiApiKey.trim() !== '') {
            const secretName = 'page-extractor-gemini-key';
            try {
                this.app.secretStorage.setSecret(secretName, geminiApiKey);
                this.settings.geminiApiKeyName = secretName;
                await this.saveData(this.settings);
            } catch (e) {
                console.error('Page Extractor: Failed to migrate Gemini API key to SecretStorage:', e);
            }
        } else if ('geminiApiKey' in savedData) {
            // Clean up old field if it exists but is empty
            await this.saveData(this.settings);
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Update handlers with new settings
        if (this.menuHandler) {
            this.menuHandler.updateSettings(this.settings);
        }
        if (this.aiHandler) {
            this.aiHandler.updateSettings(this.settings);
        }
        // Update ribbon icon based on settings
        this.updateAIRibbonIcon();
    }
}