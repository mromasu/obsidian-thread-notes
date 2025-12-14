/**
 * Types for thread view rendering
 */

/**
 * Content loaded from a note file
 */
export interface NoteContent {
    /** File path */
    path: string;
    /** YAML frontmatter (including --- delimiters) */
    frontmatter: string;
    /** Body content (without frontmatter) */
    body: string;
    /** File creation time (for sorting) */
    ctime: number;
}

/**
 * A chain of notes representing a thread
 */
export interface ThreadChain {
    notes: NoteContent[];
}

/**
 * Complete thread data for rendering
 */
export interface ThreadData {
    /** Main thread chain from root to end */
    mainChain: ThreadChain;
    /** Reply chains (each reply's full thread) */
    replyChains: ThreadChain[];
    /** Current note path (the one opened in the view) */
    currentPath: string;
}
