import { TextFileView, WorkspaceLeaf, TFile } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ThreadContainer } from '../components/ThreadContainer';
import type MyPlugin from '../main';

export const THREAD_VIEW_TYPE = 'thread';

// Regex to match YAML frontmatter at the start of a file
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Extract YAML frontmatter from content.
 * Returns the frontmatter string (including delimiters) and the remaining content.
 */
function extractFrontmatter(content: string): { frontmatter: string; body: string } {
    const match = content.match(FRONTMATTER_REGEX);
    if (match) {
        return {
            frontmatter: match[0],
            body: content.slice(match[0].length),
        };
    }
    return { frontmatter: '', body: content };
}

export class ThreadView extends TextFileView {
    plugin: MyPlugin;
    root: Root | null = null;
    activeEditor: any = null;

    // Store the YAML frontmatter separately from the editor content
    private frontmatter: string = '';

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
        this.frontmatter = '';
    }

    getViewData(): string {
        return this.data;
    }

    setViewData(data: string, clear: boolean): void {
        // Extract and store frontmatter, keep only body for editor
        const { frontmatter, body } = extractFrontmatter(data);
        this.frontmatter = frontmatter;
        this.data = data; // Store full data for getViewData

        if (clear) {
            this.activeEditor = null;
        }

        // Render with body only (no frontmatter)
        this.renderView(body);
    }

    clear(): void {
        this.data = '';
        this.frontmatter = '';
    }

    private renderView(bodyContent?: string): void {
        if (!this.root) return;

        const context = {
            app: this.app,
            view: this,
            plugin: this.plugin,
        };

        // Use provided body content, or extract from current data
        const content = bodyContent !== undefined
            ? bodyContent
            : extractFrontmatter(this.data).body;

        this.root.render(
            <ThreadContainer
                context={context}
                content={content}
                onContentChange={(content) => this.handleContentChange(content)}
            />
        );
    }

    private handleContentChange(content: string): void {
        // Reconstruct full data with frontmatter
        const fullContent = this.frontmatter + content;

        if (this.data !== fullContent) {
            this.data = fullContent;
            this.requestSave();
        }
    }
}
