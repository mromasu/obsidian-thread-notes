/**
 * ThreadGraph - Simple graph for managing thread connections
 * 
 * Uses Maps for efficient lookups:
 * - prevMap: notePath → prevNotePath (explicit from frontmatter)
 * - nextMap: notePath → nextNotePaths[] (implied from prevMap inversion)
 */
export class ThreadGraph {
    /** Explicit prev edges from frontmatter: currentNote → prevNote */
    private prevMap: Map<string, string | null> = new Map();

    /** Implied next edges (inverted prevMap): currentNote → nextNotes[] */
    private nextMap: Map<string, string[]> = new Map();

    /**
     * Get the previous note in the thread
     */
    getPrev(path: string): string | null {
        return this.prevMap.get(path) ?? null;
    }

    /**
     * Get all notes that follow this note in threads
     * (A note can have multiple "next" if threads fork)
     */
    getNext(path: string): string[] {
        return this.nextMap.get(path) ?? [];
    }

    /**
     * Set the prev relationship for a note
     */
    setPrev(path: string, prevPath: string | null): void {
        this.prevMap.set(path, prevPath);
    }

    /**
     * Check if a note exists in the graph
     */
    hasNode(path: string): boolean {
        return this.prevMap.has(path);
    }

    /**
     * Get all nodes in the graph
     */
    getAllNodes(): string[] {
        return Array.from(this.prevMap.keys());
    }

    /**
     * Build the nextMap by inverting prevMap relationships
     * Call this after all prev edges have been added
     */
    buildNextMap(): void {
        this.nextMap.clear();

        for (const [notePath, prevPath] of this.prevMap.entries()) {
            if (prevPath) {
                // If note A has prev: B, then B has next: A
                const existing = this.nextMap.get(prevPath) ?? [];
                existing.push(notePath);
                this.nextMap.set(prevPath, existing);
            }
        }
    }

    /**
     * Clear the graph
     */
    clear(): void {
        this.prevMap.clear();
        this.nextMap.clear();
    }

    /**
     * Get debug info for console logging
     */
    toDebugObject(): { prevMap: Record<string, string | null>; nextMap: Record<string, string[]> } {
        return {
            prevMap: Object.fromEntries(this.prevMap),
            nextMap: Object.fromEntries(this.nextMap),
        };
    }
}
