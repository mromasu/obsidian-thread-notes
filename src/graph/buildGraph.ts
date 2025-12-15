import { App, TFile, CachedMetadata, FrontMatterCache } from 'obsidian';
import { ThreadGraph } from './ThreadGraph';

/**
 * Extract a string value from a potentially complex frontmatter value
 * Handles: strings, arrays (uses first), link objects
 */
function extractStringValue(value: any): string | null {
    if (!value) return null;

    // Handle array: recursively extract from first element
    if (Array.isArray(value)) {
        return extractStringValue(value[0]);
    }

    // Handle string directly
    if (typeof value === 'string') {
        return value;
    }

    // Handle link object (Obsidian sometimes parses links as objects)
    if (typeof value === 'object') {
        // Try common link object properties
        if (value.path) return String(value.path);
        if (value.link) return String(value.link);
        // Fallback: try to stringify
        return null;
    }

    return null;
}

/**
 * Extract the prev link from frontmatter
 * Handles both single link and array of links (uses first)
 */
function extractPrevFromFrontmatter(
    frontmatter: FrontMatterCache | undefined
): string | null {
    if (!frontmatter?.prev) {
        return null;
    }

    return extractStringValue(frontmatter.prev);
}

/**
 * Clean a wikilink to get the note name
 * [[NoteName]] → NoteName
 * [[path/to/NoteName]] → path/to/NoteName
 * [[NoteName|alias]] → NoteName
 */
function cleanWikilink(link: string | null): string {
    if (!link || typeof link !== 'string') {
        return '';
    }

    // Remove [[ and ]]
    let cleaned = link.replace(/^\[\[/, '').replace(/\]\]$/, '');

    // Remove alias part (|alias)
    const pipeIndex = cleaned.indexOf('|');
    if (pipeIndex !== -1) {
        cleaned = cleaned.substring(0, pipeIndex);
    }

    return cleaned.trim();
}

/**
 * Build the thread graph from all markdown files in the vault
 */
export function buildGraph(app: App, graph: ThreadGraph): void {
    graph.clear();

    const markdownFiles = app.vault.getMarkdownFiles();

    for (const file of markdownFiles) {
        const cache = app.metadataCache.getFileCache(file);
        const prevLink = extractPrevFromFrontmatter(cache?.frontmatter);
        const isThread = cache?.frontmatter?.thread === true;

        if (prevLink) {
            // Clean the wikilink format
            const cleanedLink = cleanWikilink(prevLink);

            // Resolve the link to an absolute path
            const targetFile = app.metadataCache.getFirstLinkpathDest(
                cleanedLink,
                file.path
            );

            // Use resolved path or construct unresolved path
            const prevPath = targetFile?.path ?? `${cleanedLink}.md`;

            graph.setPrev(file.path, prevPath);
        } else {
            // Note has no prev (start of a thread or standalone)
            graph.setPrev(file.path, null);
        }

        // Set thread marker
        graph.setIsMainThread(file.path, isThread);
    }

    // Build implied next edges
    graph.buildNextMap();

    // Debug logging
    console.log('Thread graph built:', graph.toDebugObject());
}
