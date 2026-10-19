import { App, Menu, TFile, Notice, MarkdownView } from 'obsidian';
import { PdfDetector } from './pdf-detector';
import { TextExtractor } from './text-extractor';
import { NoteCreator } from './note-creator';
import { PageExtractorSettings } from './types';

export class MenuHandler {
    private pdfDetector: PdfDetector;
    private textExtractor: TextExtractor;
    private noteCreator: NoteCreator;

    constructor(private app: App, private settings: PageExtractorSettings) {
        this.pdfDetector = new PdfDetector(app);
        this.textExtractor = new TextExtractor(app);
        this.noteCreator = new NoteCreator(app, settings);
    }

    updateSettings(settings: PageExtractorSettings) {
        this.settings = settings;
        this.noteCreator = new NoteCreator(this.app, settings);
    }

    addPdfPageExtractMenuItems(menu: Menu, data: { pageNumber: number; selection?: string }) {
        const { pageNumber } = data;
        
        menu.addSeparator();
        
        const pdfInfo = this.pdfDetector.getCurrentPdfInfo();
        if (!pdfInfo) {
            menu.addItem((item) => {
                item.setTitle('No PDF detected').setDisabled(true);
            });
            return;
        }

        const pageData = { ...pdfInfo, pageNumber };

        menu.addItem((item) => {
            item
                .setTitle(`Extract page ${pageNumber} text to new note`)
                .setIcon('file-plus')
                .onClick(() => this.extractPdfPage(pageData, 'new-note'));
        });

        menu.addItem((item) => {
            item
                .setTitle(`Extract page ${pageNumber} text to current note`)
                .setIcon('file-text')
                .onClick(() => this.extractPdfPage(pageData, 'current-note'));
        });

        // Add selection extraction if there's selected text
        if (data.selection?.trim()) {
            const selection = data.selection;
            menu.addItem((item) => {
                item
                    .setTitle('Extract selected text to new note')
                    .setIcon('file-plus-2')
                    .onClick(() => this.extractSelectedText(selection, pageData, 'new-note'));
            });

            menu.addItem((item) => {
                item
                    .setTitle('Extract selected text to current note')
                    .setIcon('file-text')
                    .onClick(() => this.extractSelectedText(selection, pageData, 'current-note'));
            });
        }
    }

    addPdfFileContextMenuItems(menu: Menu, file: TFile) {
        menu.addSeparator();
        
        menu.addItem((item) => {
            item
                .setTitle('Extract full PDF text')
                .setIcon('file-text')
                .onClick(() => this.extractFullPdfText(file));
        });
        
        menu.addItem((item) => {
            item
                .setTitle('Extract all pages to notes')
                .setIcon('files')
                .onClick(() => this.extractAllPdfPages(file));
        });
    }

    async extractPdfPage(info: { file: TFile; pageNumber: number; path: string }, mode: 'new-note' | 'current-note') {
        try {
            new Notice(`Extracting text from page ${info.pageNumber}...`);
            
            const extractedText = await this.textExtractor.extractTextFromPdfPage(info.path, info.pageNumber);
            
            if (mode === 'new-note') {
                const fileName = await this.noteCreator.createNewNoteWithText(extractedText, info.path, info.pageNumber);
                new Notice(`Created note: ${fileName}`);
            } else {
                try {
                    const targetPreference = this.settings.appendToRightmostNote ? 'rightmost' : 'current';
                    await this.noteCreator.appendTextToTargetNote(extractedText, info.path, info.pageNumber, targetPreference);
                    const targetDesc = this.settings.appendToRightmostNote ? 'rightmost note' : 'current note';
                    new Notice(`Text appended to ${targetDesc}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    new Notice(message);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error extracting PDF page:', error);
            new Notice(`Error: ${message}`);
        }
    }

    async extractSelectedText(selectedText: string, info: { file: TFile; pageNumber: number; path: string }, mode: 'new-note' | 'current-note') {
        try {
            new Notice('Extracting selected text...');
            
            const formattedText = selectedText.trim();
            
            if (mode === 'new-note') {
                const fileName = await this.noteCreator.createNewNoteWithText(formattedText, info.path, info.pageNumber);
                new Notice(`Created note: ${fileName}`);
            } else {
                try {
                    const targetPreference = this.settings.appendToRightmostNote ? 'rightmost' : 'current';
                    await this.noteCreator.appendTextToTargetNote(formattedText, info.path, info.pageNumber, targetPreference);
                    const targetDesc = this.settings.appendToRightmostNote ? 'rightmost note' : 'current note';
                    new Notice(`Selected text appended to ${targetDesc}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    new Notice(message);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error extracting selected text:', error);
            new Notice(`Error: ${message}`);
        }
    }

    async extractFullPdfText(file: TFile) {
        try {
            new Notice('Extracting full PDF text...');
            
            const extractedText = await this.textExtractor.extractTextFromPdf(file);
            const fileName = await this.noteCreator.createNewNoteWithText(extractedText, file.path);
            
            new Notice(`Created note with full PDF text: ${fileName}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error extracting full PDF text:', error);
            new Notice(`Error: ${message}`);
        }
    }

    async extractAllPdfPages(file: TFile) {
        try {
            new Notice('Extracting text from all PDF pages...');
            
            const pages = await this.textExtractor.getPdfPageCount(file.path);
            
            for (let i = 1; i <= pages; i++) {
                new Notice(`Extracting page ${i} of ${pages}...`);
                const extractedText = await this.textExtractor.extractTextFromPdfPage(file.path, i);
                await this.noteCreator.createNewNoteWithText(extractedText, file.path, i);
            }

            new Notice(`Extracted text from ${pages} pages!`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error extracting all PDF pages:', error);
            new Notice(`Error: ${message}`);
        }
    }

    getCurrentPdfPageInfo() {
        const pdfInfo = this.pdfDetector.getCurrentPdfInfo();
        if (!pdfInfo) return null;

        const pageNumber = this.pdfDetector.getCurrentPageFromPdfPlus() || 1;

        return {
            ...pdfInfo,
            pageNumber
        };
    }
}