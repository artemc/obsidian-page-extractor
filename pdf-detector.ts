import { App, MarkdownView, TFile } from 'obsidian';
import { PdfInfo } from './types';

export class PdfDetector {
    constructor(private app: App) {}

    getCurrentPdfInfo(): PdfInfo | null {
        // Strategy 1: Check active file directly
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile?.extension.toLowerCase() === 'pdf') {
            return { file: activeFile, path: activeFile.path };
        }

        // Strategy 2: Check PDF++ embedded content
        const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeLeaf) {
            const pdfEmbed = activeLeaf.containerEl.querySelector('.pdf-embed[src], .pdf-container, [data-type="pdf"], .pdf-viewer');
            
            if (pdfEmbed) {
                const srcAttr = pdfEmbed.getAttribute('src') || 
                               pdfEmbed.getAttribute('data-src') ||
                               pdfEmbed.getAttribute('data-path');
                if (srcAttr) {
                    const filePath = srcAttr.split('#')[0];
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    
                    if (file instanceof TFile && file.extension.toLowerCase() === 'pdf') {
                        return { file, path: file.path };
                    }
                }
            }
        }

        // Strategy 3: Check PDF viewer leaves
        const leaves = this.app.workspace.getLeavesOfType('pdf');
        if (leaves.length > 0) {
            // @ts-expect-error - accessing internal PDF view state (no public API for pdf leaf file)
            const file = leaves[0].view?.file;
            if (file?.extension.toLowerCase() === 'pdf') {
                return { file, path: file.path };
            }
        }

        // Strategy 4: Check recent files with DOM verification
        const recentFiles = this.app.workspace.getLastOpenFiles();
        const pdfViewers = document.querySelectorAll('.pdf-viewer, .pdf-embed, [data-type="pdf"]');
        
        for (const filePath of recentFiles) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile && file.extension.toLowerCase() === 'pdf') {
                for (const viewer of Array.from(pdfViewers)) {
                    const src = viewer.getAttribute('src') || viewer.getAttribute('data-src') || viewer.getAttribute('data-path');
                    if (src?.includes(file.path)) {
                        return { file, path: file.path };
                    }
                }
            }
        }

        return null;
    }

    getCurrentPageFromPdfPlus(): number | null {
        const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeLeaf) return null;

        const pageElements = activeLeaf.containerEl.querySelectorAll('[data-page-number], .pdf-page-container.active');
        
        if (pageElements.length > 0) {
            const element = pageElements[0];
            const pageNumber = element.getAttribute('data-page-number') || 
                              element.classList.toString().match(/page-(\d+)/)?.[1];
            
            if (pageNumber) {
                return parseInt(pageNumber, 10);
            }
        }
        
        return null;
    }
}