/**
 * Type definitions for chain insertion operations
 */

/**
 * Represents the context captured when an insertion is triggered
 */
export interface InsertionContext {
    /** Path of the note where insertion is triggered */
    sourcePath: string;
    /** Title/basename of source note for link creation */
    sourceTitle: string;
    /** Path of the next note in main chain (if inserting mid-chain) */
    nextPath: string | null;
    /** Whether this is an end-of-chain append (no next note) */
    isAppend: boolean;
}

/**
 * Result of a successful note creation
 */
export interface CreatedNote {
    /** Full path to the created note */
    path: string;
    /** Title/basename of the created note */
    title: string;
}

/**
 * Operations needed to update files after insertion
 */
export interface FrontmatterMutation {
    /** File path to modify */
    targetPath: string;
    /** Property name to update */
    property: string;
    /** New value for the property */
    value: string | boolean | null;
}
