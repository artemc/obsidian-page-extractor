import { App, Menu, TFile, Notice } from 'obsidian';
import { PdfDetector } from './pdf-detector';
import { TextExtractor } from './text-extractor';
import { NoteCreator } from './note-creator';
import { PageExtractorSettings } from './types';
import { ExtractMode, PageRangeModal } from './page-range-modal';

type PageInfo = { file: TFile; pageNumber: number; path: string };

export class MenuHandler {
    private pdfDetector: PdfDetector;
    private textExtractor: TextExtractor;
    private noteCreator: NoteCreator;
    // Start of a page range, set from the page context menu
    private rangeStart: { path: string; page: number } | null = null;

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

        this.addRangeMenuItems(menu, pageData);

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

    private addRangeMenuItems(menu: Menu, info: PageInfo) {
        const page = info.pageNumber;
        const mark = this.rangeStart?.path === info.path ? this.rangeStart.page : null;

        if (mark === page) {
            menu.addItem((item) => {
                item
                    .setTitle('Clear range start mark')
                    .setIcon('bookmark-x')
                    .onClick(() => { this.rangeStart = null; });
            });
        } else {
            menu.addItem((item) => {
                item
                    .setTitle(`Mark page ${page} as range start`)
                    .setIcon('bookmark')
                    .onClick(() => this.markRangeStart(info));
            });
        }

        if (mark !== null && mark !== page) {
            const from = Math.min(mark, page);
            const to = Math.max(mark, page);
            menu.addItem((item) => {
                item
                    .setTitle(`Extract pages ${from}-${to} to new note`)
                    .setIcon('file-plus')
                    .onClick(() => this.extractPdfPages(info, from, to, 'new-note'));
            });
            menu.addItem((item) => {
                item
                    .setTitle(`Extract pages ${from}-${to} to current note`)
                    .setIcon('file-text')
                    .onClick(() => this.extractPdfPages(info, from, to, 'current-note'));
            });
        }

        menu.addItem((item) => {
            item
                .setTitle('Extract page range...')
                .setIcon('files')
                .onClick(() => this.openPageRangeModal(info));
        });
    }

    markRangeStart(info: PageInfo) {
        this.rangeStart = { path: info.path, page: info.pageNumber };
        new Notice(`Page ${info.pageNumber} marked as range start`);
    }

    async openPageRangeModal(info: PageInfo) {
        const mark = this.rangeStart?.path === info.path ? this.rangeStart.page : info.pageNumber;
        const pageCount = await this.textExtractor.getPdfPageCount(info.path);
        new PageRangeModal(
            this.app,
            Math.min(mark, info.pageNumber),
            Math.max(mark, info.pageNumber),
            pageCount,
            (from, to, mode) => void this.extractPdfPages(info, from, to, mode)
        ).open();
    }

    async extractPdfPages(info: PageInfo, from: number, to: number, mode: ExtractMode) {
        try {
            new Notice(`Extracting text from pages ${from}-${to}...`);

            const parts: string[] = [];
            for (let page = from; page <= to; page++) {
                const text = await this.textExtractor.extractTextFromPdfPage(info.path, page);
                parts.push(`## Page ${page}\n\n${text.trim()}`);
            }
            const extractedText = parts.join('\n\n');

            if (mode === 'new-note') {
                const fileName = await this.noteCreator.createNewNoteWithText(extractedText, info.path, { from, to });
                new Notice(`Created note: ${fileName}`);
            } else {
                const targetPreference = this.settings.appendToRightmostNote ? 'rightmost' : 'current';
                await this.noteCreator.appendTextToTargetNote(extractedText, info.path, from, targetPreference);
                new Notice(`Pages ${from}-${to} appended to ${this.settings.appendToRightmostNote ? 'rightmost note' : 'current note'}`);
            }
            this.rangeStart = null;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error extracting PDF pages:', error);
            new Notice(`Error: ${message}`);
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