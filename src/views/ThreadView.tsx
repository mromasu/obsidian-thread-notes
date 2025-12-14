import { TextFileView, WorkspaceLeaf, TFile } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ThreadContainer } from '../components/ThreadContainer';
import type MyPlugin from '../main';

export const THREAD_VIEW_TYPE = 'thread';

export class ThreadView extends TextFileView {
    plugin: MyPlugin;
    root: Root | null = null;
    activeEditor: any = null;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return THREAD_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file?.basename || 'Thread';
    }

    getIcon(): string {
        return 'messages-square';
    }

    async onOpen(): Promise<void> {
        // Create React root
        this.contentEl.empty();
        this.contentEl.addClass('thread-view');
        this.root = createRoot(this.contentEl);
    }

    async onClose(): Promise<void> {
        // Cleanup React root
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
        this.activeEditor = null;
    }

    getViewData(): string {
        return this.data;
    }

    setViewData(data: string, clear: boolean): void {
        this.data = data;

        if (clear) {
            this.activeEditor = null;
        }

        this.renderView();
    }

    clear(): void {
        this.data = '';
    }

    private renderView(): void {
        if (!this.root) return;

        const context = {
            app: this.app,
            view: this,
            plugin: this.plugin,
        };

        this.root.render(
            <ThreadContainer
                context={context}
                content={this.data}
                onContentChange={(content) => this.handleContentChange(content)}
            />
        );
    }

    private handleContentChange(content: string): void {
        if (this.data !== content) {
            this.data = content;
            this.requestSave();
        }
    }
}
