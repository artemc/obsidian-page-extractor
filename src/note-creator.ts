import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { PageExtractorSettings } from './types';

export class NoteCreator {
    // Leaf in the right split that received the last extracted note
    private splitLeaf: WorkspaceLeaf | null = null;

    constructor(private app: App, private settings: PageExtractorSettings) {}

    // Reuse the existing right split: open each new note as a new tab there instead of splitting again
    private getTargetLeaf(): WorkspaceLeaf {
        const workspace = this.app.workspace;
        if (!this.settings.openToTheRight) return workspace.getLeaf(false);

        const active = workspace.getMostRecentLeaf();
        const activeX = active ? active.view.containerEl.getBoundingClientRect().x : -Infinity;

        // Prefer the split that got the last extracted note, otherwise the rightmost existing
        // tab group to the right of the active one (e.g. a split made by hand)
        let target: WorkspaceLeaf | null = null;
        let maxX = activeX;
        workspace.iterateRootLeaves(leaf => {
            if (leaf.parent === active?.parent) return;
            if (leaf === this.splitLeaf) {
                target = leaf;
                maxX = Infinity;
                return;
            }
            const rect = leaf.view.containerEl.getBoundingClientRect();
            // Background tabs have no size; the visible tab stands for its group
            if (rect.width > 0 && rect.x > maxX) {
                maxX = rect.x;
                target = leaf;
            }
        });

        let leaf: WorkspaceLeaf;
        if (target) {
            workspace.setActiveLeaf(target, { focus: false });
            leaf = workspace.getLeaf('tab');
        } else {
            leaf = workspace.getLeaf('split', 'vertical');
        }
        this.splitLeaf = leaf;
        return leaf;
    }

    async createNewNoteWithText(extractedText: string, pdfPath: string, pageNumber?: number) {
        const fileName = this.generateFileName(pdfPath, pageNumber);
        const folderPath = this.settings.noteFolder;
        const fullPath = folderPath ? `${folderPath}/${fileName}.md` : `${fileName}.md`;

        // Ensure the folder exists
        if (folderPath) {
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }
        }

        const noteContent = this.formatExtractedText(extractedText, pdfPath, pageNumber);
        
        try {
            const file = await this.app.vault.create(fullPath, noteContent);
            
            // Open the new note - either to the right or in current pane
            const leaf = this.getTargetLeaf();
            await leaf.openFile(file);
            
            return fileName;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('already exists')) {
                const timestamp = Date.now();
                const uniquePath = folderPath ? `${folderPath}/${fileName}-${timestamp}.md` : `${fileName}-${timestamp}.md`;
                const file = await this.app.vault.create(uniquePath, noteContent);
                
                // Open the new note - either to the right or in current pane
                const leaf = this.getTargetLeaf();
                await leaf.openFile(file);
                
                return `${fileName}-${timestamp}`;
            }
            throw error;
        }
    }

    async appendTextToTargetNote(extractedText: string, pdfPath: string, pageNumber: number, targetPreference: 'current' | 'rightmost' = 'current') {
        let targetView: MarkdownView | null = null;

        if (targetPreference === 'rightmost') {
            targetView = this.findRightmostMarkdownView();
        }
        
        // Fallback to current active view if rightmost not found or not specified
        if (!targetView) {
            targetView = this.app.workspace.getActiveViewOfType(MarkdownView);
        }

        if (!targetView) {
            throw new Error('No active note to append to');
        }

        const editor = targetView.editor;
        const lastLine = editor.lastLine();
        const endOfFile = { line: lastLine, ch: editor.getLine(lastLine).length };
        
        const formattedText = `\n\n${extractedText.trim()}`;
        
        editor.replaceRange(formattedText, endOfFile);

        // Focus the target view to make it clear where the text was added
        this.app.workspace.setActiveLeaf(targetView.leaf);
    }

    private findRightmostMarkdownView(): MarkdownView | null {
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        if (leaves.length === 0) return null;

        // Find the leaf with the highest x-coordinate (rightmost position)
        let rightmostLeaf: WorkspaceLeaf | undefined;
        let maxX = -Infinity;

        for (const leaf of leaves) {
            // Get the DOM element of the leaf to check its position
            const leafEl = leaf.view.containerEl;
            const rect = leafEl.getBoundingClientRect();
            
            if (rect.x >= maxX) {
                maxX = rect.x;
                rightmostLeaf = leaf;
            }
        }

        return rightmostLeaf?.view instanceof MarkdownView ? rightmostLeaf.view : null;
    }

    private generateFileName(pdfPath: string, pageNumber?: number): string {
        const now = new Date();
        const pdfName = pdfPath.split('/').pop()?.replace('.pdf', '') || 'Unknown PDF';
        
        let fileName = this.settings.noteNameTemplate
            .replace('{{date}}', now.toISOString().slice(0, 10))
            .replace('{{time}}', now.toTimeString().slice(0, 8).replace(/:/g, '-'))
            .replace('{{pdf}}', pdfName)
            .replace('{{page}}', pageNumber?.toString() || 'Full');
        
        if (this.settings.includeSourcePdfName && !this.settings.noteNameTemplate.includes('{{pdf}}')) {
            fileName = `${pdfName} - ${fileName}`;
        }
        
        if (this.settings.includePageNumber && !this.settings.noteNameTemplate.includes('{{page}}')) {
            fileName = pageNumber ? `${fileName} - Page ${pageNumber}` : `${fileName} - Full PDF`;
        }
        
        return fileName.replace(/[<>:"/\\|?*]/g, '-');
    }

    private formatExtractedText(text: string, pdfPath: string, pageNumber?: number): string {
        const pdfName = pdfPath.split('/').pop() || 'Unknown PDF';
        
        // Create the link field in the format [[filename#page=pageNumber]]
        const linkValue = pageNumber 
            ? `"[[${pdfName}#page=${pageNumber}]]"`
            : `"[[${pdfName}]]"`;
        const backlinkValue = pageNumber 
            ? `"[[${pdfName}#page=${pageNumber}&rect=0,0,10,10|go back]]"`
            : `"[[${pdfName}]]"`;
        
        const frontmatter = `---
link: ${linkValue}
backlink: ${backlinkValue}
---

`;
        
        return `${frontmatter}${text.trim()}`;
    }
}