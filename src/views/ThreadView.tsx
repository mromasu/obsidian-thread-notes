import { TextFileView, WorkspaceLeaf, TFile, App } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ThreadContainer } from '../components/ThreadContainer';
import { parseFrontmatter, serializeFrontmatter, Property, PropertyType } from '../components/yamlUtils';
import type MyPlugin from '../main';
import type { NoteContent, ThreadData, ThreadChain } from './types';

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

/**
 * Load note content from a file path
 */
async function loadNoteContent(app: App, path: string): Promise<NoteContent | null> {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;

    const content = await app.vault.read(file);
    const { frontmatter, body } = extractFrontmatter(content);

    return {
        path,
        frontmatter,
        body,
        ctime: file.stat.ctime,
    };
}

export class ThreadView extends TextFileView {
    plugin: MyPlugin;
    root: Root | null = null;
    activeEditor: any = null;

    // Store loaded thread data
    private threadData: ThreadData | null = null;
    // Store current note properties
    private currentNoteProperties: Property[] = [];
    // Counter for triggering add property form (increment to trigger)
    private _triggerAddPropertyFormCounter: number = 0;

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
        this.threadData = null;
        this.currentNoteProperties = [];
    }

    getViewData(): string {
        return this.data;
    }

    setViewData(data: string, clear: boolean): void {
        this.data = data;

        if (clear) {
            this.activeEditor = null;
        }

        // Parse current note properties
        const { frontmatter } = extractFrontmatter(data);
        this.currentNoteProperties = parseFrontmatter(frontmatter);

        // Load thread data and render
        this.loadAndRender();
    }

    clear(): void {
        this.data = '';
        this.threadData = null;
        this.currentNoteProperties = [];
    }

    /**
     * Load thread data from graph and render
     */
    private async loadAndRender(): Promise<void> {
        if (!this.file || !this.root) return;

        const path = this.file.path;
        const graph = this.plugin.graph;

        // Get main thread chain
        const mainChainPaths = graph.getFullThread(path);
        const mainNotes = await Promise.all(
            mainChainPaths.map(p => loadNoteContent(this.app, p))
        );
        const mainChain: ThreadChain = {
            notes: mainNotes.filter((n): n is NoteContent => n !== null),
        };

        // Get reply chains for current note, sorted by ctime
        const replyChainPaths = graph.getReplyChains(path);
        const replyChains: ThreadChain[] = [];

        for (const chainPaths of replyChainPaths) {
            const notes = await Promise.all(
                chainPaths.map(p => loadNoteContent(this.app, p))
            );
            const chain: ThreadChain = {
                notes: notes.filter((n): n is NoteContent => n !== null),
            };
            if (chain.notes.length > 0) {
                replyChains.push(chain);
            }
        }

        // Sort reply chains by first note's ctime
        replyChains.sort((a, b) => {
            const ctimeA = a.notes[0]?.ctime ?? 0;
            const ctimeB = b.notes[0]?.ctime ?? 0;
            return ctimeA - ctimeB;
        });

        this.threadData = {
            mainChain,
            replyChains,
            currentPath: path,
        };

        this.renderView();
    }

    private renderView(): void {
        if (!this.root || !this.threadData) return;

        const context = {
            app: this.app,
            view: this,
            plugin: this.plugin,
        };

        this.root.render(
            <ThreadContainer
                context={context}
                threadData={this.threadData}
                currentNoteProperties={this.currentNoteProperties}
                onContentChange={(body, filePath) => this.handleContentChange(body, filePath)}
                onPropertiesChange={(properties) => this.handlePropertiesChange(properties)}
                triggerAddPropertyForm={this._triggerAddPropertyFormCounter}
                onAddFormChange={() => {
                    // No-op - counter-based trigger doesn't need reset
                }}
            />
        );
    }

    /**
     * Handle content change from any editor
     */
    private async handleContentChange(body: string, filePath: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return;

        // Find the note in our thread data to get its frontmatter
        let frontmatter = '';
        const allNotes = [
            ...this.threadData?.mainChain.notes ?? [],
            ...this.threadData?.replyChains.flatMap(c => c.notes) ?? [],
        ];
        const note = allNotes.find(n => n.path === filePath);
        if (note) {
            frontmatter = note.frontmatter;
        }

        // Reconstruct full content
        const fullContent = frontmatter + body;

        // Save to file
        await this.app.vault.modify(file, fullContent);

        // Update local data if this is the current file
        if (filePath === this.file?.path) {
            this.data = fullContent;
        }

        // Update note content in threadData
        if (note) {
            note.body = body;
        }
    }

    /**
     * Handle properties change from PropertyEditor
     */
    private async handlePropertiesChange(properties: Property[]): Promise<void> {
        if (!this.file) return;

        // Update local properties
        this.currentNoteProperties = properties;

        // Get current body
        const { body } = extractFrontmatter(this.data);

        // Serialize new frontmatter
        const newFrontmatter = serializeFrontmatter(properties);

        // Reconstruct full content
        const fullContent = newFrontmatter + body;

        // Save to file
        await this.app.vault.modify(this.file, fullContent);

        // Update local data
        this.data = fullContent;

        // Update in threadData if current note is in there
        const currentNote = this.threadData?.mainChain.notes.find(
            n => n.path === this.file?.path
        );
        if (currentNote) {
            currentNote.frontmatter = newFrontmatter;
        }

        // Re-render
        this.renderView();
    }

    /**
     * Toggle properties panel visibility
     */
    togglePropertiesVisibility(): void {
        if (this.contentEl.hasClass('properties-hidden')) {
            this.contentEl.removeClass('properties-hidden');
        } else {
            this.contentEl.addClass('properties-hidden');
        }
    }

    /**
     * Add a new property programmatically
     */
    addProperty(name: string, type: PropertyType, value: any): void {
        // Check if property already exists
        if (this.currentNoteProperties.some(p => p.name === name)) {
            return;
        }

        this.currentNoteProperties.push({ name, type, value });
        this.handlePropertiesChange(this.currentNoteProperties);
    }

    /**
     * Get current properties
     */
    getProperties(): Property[] {
        return this.currentNoteProperties;
    }

    /**
     * Check if properties panel is visible
     */
    isPropertiesVisible(): boolean {
        return !this.contentEl.hasClass('properties-hidden');
    }

    /**
     * Open add property form (opens properties panel if hidden and triggers form)
     */
    triggerAddPropertyForm(): void {
        // Ensure properties panel is visible
        if (this.contentEl.hasClass('properties-hidden')) {
            this.contentEl.removeClass('properties-hidden');
        }

        // Increment trigger counter and re-render
        this._triggerAddPropertyFormCounter++;
        this.renderView();
    }
}

