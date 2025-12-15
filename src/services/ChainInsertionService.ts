/**
 * ChainInsertionService - Orchestrates the chain insertion process
 * 
 * Handles:
 * 1. Building insertion context from current editor state
 * 2. Creating new notes with proper frontmatter
 * 3. Calculating and applying graph mutations
 * 4. Triggering view re-render
 */

import { App, TFile, normalizePath } from 'obsidian';
import { ThreadGraph } from '../graph/ThreadGraph';
import type { InsertionContext, CreatedNote, FrontmatterMutation } from './InsertionTypes';

/**
 * Generate a timestamp-based note name
 * Format: YYYYMMDD-HHmmss-SSS
 */
function generateNoteName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}-${ms}`;
}

/**
 * Create frontmatter YAML string from properties
 */
function createFrontmatter(properties: Record<string, any>): string {
    const lines = Object.entries(properties).map(([key, value]) => {
        if (typeof value === 'boolean') {
            return `${key}: ${value}`;
        }
        if (typeof value === 'string') {
            // Wikilinks don't need quotes
            if (value.startsWith('[[') && value.endsWith(']]')) {
                return `${key}: ${value}`;
            }
            return `${key}: ${value}`;
        }
        return `${key}: ${value}`;
    });

    return `---\n${lines.join('\n')}\n---\n`;
}

export class ChainInsertionService {
    constructor(
        private app: App,
        private graph: ThreadGraph,
        private onGraphUpdate: () => void,
        private getFolder: () => string
    ) { }

    /**
     * Build context from current editor state
     */
    buildInsertionContext(currentPath: string): InsertionContext {
        const file = this.app.vault.getAbstractFileByPath(currentPath);
        const sourceTitle = file instanceof TFile ? file.basename : currentPath.replace(/\.md$/, '');

        // Get the main continuation (next note in chain with thread: true)
        const nextPath = this.graph.getMainContinuation(currentPath);

        return {
            sourcePath: currentPath,
            sourceTitle,
            nextPath,
            isAppend: nextPath === null,
        };
    }

    /**
     * Create a new note with prev and thread: true
     */
    async createNote(context: InsertionContext): Promise<CreatedNote> {
        const title = generateNoteName();
        const folder = this.getFolder();

        // Ensure folder exists if specified
        if (folder) {
            const folderExists = this.app.vault.getAbstractFileByPath(folder);
            if (!folderExists) {
                await this.app.vault.createFolder(folder);
            }
        }

        // Build path with folder prefix
        const path = folder
            ? normalizePath(`${folder}/${title}.md`)
            : normalizePath(`${title}.md`);

        // Build frontmatter with prev link and thread marker
        const frontmatter = createFrontmatter({
            prev: `[[${context.sourceTitle}]]`,
            thread: true,
        });

        // Create the file with frontmatter only (body is empty)
        await this.app.vault.create(path, frontmatter + '\n');

        return { path, title };
    }

    /**
     * Calculate required frontmatter mutations
     */
    calculateMutations(
        context: InsertionContext,
        created: CreatedNote
    ): FrontmatterMutation[] {
        const mutations: FrontmatterMutation[] = [];

        // If inserting mid-chain, update the next note's prev to point to new note
        if (!context.isAppend && context.nextPath) {
            mutations.push({
                targetPath: context.nextPath,
                property: 'prev',
                value: `[[${created.title}]]`,
            });
        }

        return mutations;
    }

    /**
     * Apply a single frontmatter mutation to a file
     */
    private async applyMutation(mutation: FrontmatterMutation): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(mutation.targetPath);
        if (!(file instanceof TFile)) return;

        const content = await this.app.vault.read(file);

        // Parse existing frontmatter
        const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

        if (frontmatterMatch) {
            const frontmatterContent = frontmatterMatch[1];
            const body = content.slice(frontmatterMatch[0].length);

            // Parse properties
            const lines = frontmatterContent.split('\n');
            const properties: Record<string, string> = {};
            let found = false;

            for (const line of lines) {
                const match = line.match(/^([^:]+):\s*(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim();
                    if (key === mutation.property) {
                        properties[key] = String(mutation.value);
                        found = true;
                    } else {
                        properties[key] = value;
                    }
                }
            }

            // Add property if not found
            if (!found) {
                properties[mutation.property] = String(mutation.value);
            }

            // Reconstruct frontmatter
            const newFrontmatter = createFrontmatter(properties);
            const newContent = newFrontmatter + body;

            await this.app.vault.modify(file, newContent);
        } else {
            // No frontmatter exists, create one
            const newFrontmatter = createFrontmatter({
                [mutation.property]: mutation.value,
            });
            const newContent = newFrontmatter + content;
            await this.app.vault.modify(file, newContent);
        }
    }

    /**
     * Apply all mutations to files
     */
    async applyMutations(mutations: FrontmatterMutation[]): Promise<void> {
        for (const mutation of mutations) {
            await this.applyMutation(mutation);
        }
    }

    /**
     * Update graph after insertion
     */
    private updateGraph(context: InsertionContext, created: CreatedNote): void {
        if (context.isAppend) {
            // Simple append at end of chain
            this.graph.setPrev(created.path, context.sourcePath);
            this.graph.setIsMainThread(created.path, true);

            // Add to source's next list
            const sourceNexts = this.graph.getNext(context.sourcePath);
            // Graph needs rebuild to pick this up properly
        } else if (context.nextPath) {
            // Mid-chain insertion: A → [new] → B
            // 1. new.prev = A
            this.graph.setPrev(created.path, context.sourcePath);
            this.graph.setIsMainThread(created.path, true);

            // 2. B.prev = new (already updated in file, graph needs to reflect)
            this.graph.setPrev(context.nextPath, created.path);
        }

        // Rebuild next map to ensure consistency
        this.graph.buildNextMap();
    }

    /**
     * Full insertion flow: context → create → mutate → rebuild → render
     */
    async executeInsertion(currentPath: string): Promise<CreatedNote> {
        console.log('[ChainInsertion] Starting insertion from:', currentPath);

        // 1. Build context
        const context = this.buildInsertionContext(currentPath);
        console.log('[ChainInsertion] Context:', context);

        // 2. Create new note
        const created = await this.createNote(context);
        console.log('[ChainInsertion] Created note:', created);

        // 3. Calculate mutations
        const mutations = this.calculateMutations(context, created);
        console.log('[ChainInsertion] Mutations:', mutations);

        // 4. Apply mutations to files
        await this.applyMutations(mutations);

        // 5. Update graph
        this.updateGraph(context, created);
        console.log('[ChainInsertion] Graph updated');

        // 6. Trigger re-render
        this.onGraphUpdate();

        return created;
    }
}
