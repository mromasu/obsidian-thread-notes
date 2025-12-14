/**
 * Type definitions for the Thread Graph
 */

/**
 * Represents a node in the thread graph
 */
export interface ThreadNode {
    /** File path (unique identifier) */
    path: string;
    /** Whether the file exists in the vault */
    resolved: boolean;
}

/**
 * Represents an edge in the thread graph
 */
export interface ThreadEdge {
    /** Source file path */
    source: string;
    /** Target file path */
    target: string;
    /** Edge direction: prev is explicit, next is implied */
    type: 'prev' | 'next';
    /** Whether this edge was explicitly defined in frontmatter */
    explicit: boolean;
}
