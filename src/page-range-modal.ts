import { App, Modal, Notice, Setting } from 'obsidian';

export type ExtractMode = 'new-note' | 'current-note';

// Asks for an inclusive page range and the extraction target
export class PageRangeModal extends Modal {
    constructor(
        app: App,
        private from: number,
        private to: number,
        private pageCount: number,
        private onSubmit: (from: number, to: number, mode: ExtractMode) => void
    ) {
        super(app);
    }

    onOpen() {
        this.setTitle('Extract page range');
        const { contentEl } = this;

        new Setting(contentEl)
            .setName('From page')
            .addText(text => text
                .setValue(String(this.from))
                .onChange(value => { this.from = Number(value); }));

        new Setting(contentEl)
            .setName('To page')
            .setDesc(this.pageCount > 0 ? `The PDF has ${this.pageCount} pages` : '')
            .addText(text => text
                .setValue(String(this.to))
                .onChange(value => { this.to = Number(value); }));

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('To current note')
                .onClick(() => this.submit('current-note')))
            .addButton(button => button
                .setButtonText('To new note')
                .setCta()
                .onClick(() => this.submit('new-note')));
    }

    private submit(mode: ExtractMode) {
        const { from, to, pageCount } = this;
        const maxPage = pageCount > 0 ? pageCount : Infinity;
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > maxPage || from > to) {
            new Notice(`Enter pages from 1 to ${pageCount > 0 ? pageCount : 'the last page'}, with from not greater than to`);
            return;
        }
        this.close();
        this.onSubmit(from, to, mode);
    }

    onClose() {
        this.contentEl.empty();
    }
}
