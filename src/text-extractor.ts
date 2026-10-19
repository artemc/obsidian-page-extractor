import { App, TFile, loadPdfJs } from 'obsidian';

// Minimal subset of the PDF.js API used by this plugin.
interface PdfJsLib {
    getDocument(src: { data: ArrayBuffer }): { promise: Promise<PdfDocument> };
}

interface PdfDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
}

function joinTextItems(items: unknown[]): string {
    return items
        .map(item => (item as { str?: string }).str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export class TextExtractor {
    constructor(private app: App) {}

    /**
     * Extract text from a PDF page using native PDF.js
     */
    async extractTextFromPdfPage(pdfPath: string, pageNumber: number): Promise<string> {
        try {
            // Get the TFile for the PDF
            const file = this.app.vault.getAbstractFileByPath(pdfPath);
            
            if (!(file instanceof TFile)) {
                console.warn(`File not found: ${pdfPath}`);
                return `Error: PDF file not found at ${pdfPath}`;
            }

            // Read the PDF file as array buffer
            const arrayBuffer = await this.app.vault.readBinary(file);
            
            // Load PDF.js
            const pdfjsLib = await this.loadPdfJs();
            if (!pdfjsLib) {
                return `Error: PDF.js could not be loaded`;
            }

            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            // Check if the page number is valid
            if (pageNumber < 1 || pageNumber > pdf.numPages) {
                return `Error: Page ${pageNumber} does not exist (PDF has ${pdf.numPages} pages)`;
            }

            // Get the specific page
            const page = await pdf.getPage(pageNumber);
            
            // Extract text content
            const textContent = await page.getTextContent();
            
            // Combine all text items
            const extractedText = joinTextItems(textContent.items);

            if (!extractedText) {
                return `No text found on page ${pageNumber} (may be image-based PDF)`;
            }

            return extractedText;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error extracting text from PDF page:', error);
            return `Error extracting text: ${message}`;
        }
    }

    /**
     * Extract text from entire PDF file using native PDF.js
     */
    async extractTextFromPdf(file: TFile): Promise<string> {
        try {
            // Read the PDF file as array buffer
            const arrayBuffer = await this.app.vault.readBinary(file);
            
            // Load PDF.js
            const pdfjsLib = await this.loadPdfJs();
            if (!pdfjsLib) {
                return `Error: PDF.js could not be loaded`;
            }

            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            let fullText = '';
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                const pageText = joinTextItems(textContent.items);

                if (pageText) {
                    fullText += `\n\n## Page ${pageNum}\n\n${pageText}`;
                }
            }

            if (!fullText.trim()) {
                return `No text found in PDF (may be image-based PDF)`;
            }

            return fullText.trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error extracting text from PDF:', error);
            return `Error extracting text: ${message}`;
        }
    }

    /**
     * Load the PDF.js library bundled with Obsidian.
     */
    private async loadPdfJs(): Promise<PdfJsLib | null> {
        try {
            return (await loadPdfJs()) as PdfJsLib;
        } catch (error) {
            console.error('Failed to load PDF.js:', error);
            return null;
        }
    }

    async getPdfPageCount(pdfPath: string): Promise<number> {
        try {
            const file = this.app.vault.getAbstractFileByPath(pdfPath);
            if (!(file instanceof TFile)) {
                return 0;
            }

            const arrayBuffer = await this.app.vault.readBinary(file);
            const pdfjsLib = await this.loadPdfJs();
            
            if (!pdfjsLib) {
                console.warn('PDF.js not available for page count');
                return 0;
            }

            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            return pdf.numPages;
        } catch (error) {
            console.error('Error getting PDF page count:', error);
            return 0;
        }
    }
}