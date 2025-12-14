/**
 * ThreadGraph - Simple graph for managing thread connections
 * 
 * Uses Maps for efficient lookups:
 * - prevMap: notePath → prevNotePath (explicit from frontmatter)
 * - nextMap: notePath → nextNotePaths[] (implied from prevMap inversion)
 * - threadMarkers: notePath → isMainThread (from thread: true frontmatter)
 */
export class ThreadGraph {
    /** Explicit prev edges from frontmatter: currentNote → prevNote */
    private prevMap: Map<string, string | null> = new Map();

    /** Implied next edges (inverted prevMap): currentNote → nextNotes[] */
    private nextMap: Map<string, string[]> = new Map();

    /** Track which notes are marked as main thread continuations */
    private threadMarkers: Map<string, boolean> = new Map();

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
     * Set whether a note is marked as main thread
     */
    setIsMainThread(path: string, isMain: boolean): void {
        this.threadMarkers.set(path, isMain);
    }

    /**
     * Check if a note is marked as main thread
     */
    isMainThread(path: string): boolean {
        return this.threadMarkers.get(path) ?? false;
    }

    /**
     * Get the main continuation of a thread from this note
     * Prefers notes with thread: true, falls back to first note
     */
    getMainContinuation(path: string): string | null {
        const nexts = this.getNext(path);
        if (nexts.length === 0) return null;

        // Prefer note with thread: true
        const mainThread = nexts.find(p => this.isMainThread(p));
        if (mainThread) return mainThread;

        // Fallback: first note (by insertion order)
        return nexts[0];
    }

    /**
     * Get all replies (notes that aren't the main continuation)
     */
    getReplies(path: string): string[] {
        const nexts = this.getNext(path);
        const main = this.getMainContinuation(path);
        return nexts.filter(p => p !== main);
    }

    /**
     * Find the root of a thread (walk backwards via prev until null)
     */
    getThreadRoot(path: string): string {
        let root = path;
        let prev = this.getPrev(root);
        while (prev) {
            root = prev;
            prev = this.getPrev(root);
        }
        return root;
    }

    /**
     * Get the full main thread from root to end
     * Walks backwards to find root, then forwards via main continuation
     */
    getFullThread(startPath: string): string[] {
        // Find root
        const root = this.getThreadRoot(startPath);


        // Walk forward via main continuation
        const thread: string[] = [root];
        let current = this.getMainContinuation(root);
        while (current) {
            thread.push(current);
            current = this.getMainContinuation(current);
        }

        return thread;
    }

    /**
     * Get reply chains: for each reply of a note, get its full thread chain
     * Returns array of thread chains (each chain is array of paths)
     */
    getReplyChains(path: string): string[][] {
        const replies = this.getReplies(path);
        return replies.map(replyPath => this.getFullThread(replyPath));
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
        this.threadMarkers.clear();
    }

    /**
     * Get debug info for console logging
     */
    toDebugObject(): {
        prevMap: Record<string, string | null>;
        nextMap: Record<string, string[]>;
        threadMarkers: Record<string, boolean>;
    } {
        return {
            prevMap: Object.fromEntries(this.prevMap),
            nextMap: Object.fromEntries(this.nextMap),
            threadMarkers: Object.fromEntries(this.threadMarkers),
        };
    }
}
