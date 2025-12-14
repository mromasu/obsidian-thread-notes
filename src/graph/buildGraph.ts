import { App, TFile, CachedMetadata, FrontMatterCache } from 'obsidian';
import { ThreadGraph } from './ThreadGraph';

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

    const prev = frontmatter.prev;

    // Handle array: use first element
    if (Array.isArray(prev)) {
        return prev[0] ?? null;
    }

    // Handle string (link format: [[NoteName]] or just NoteName)
    if (typeof prev === 'string') {
        return prev;
    }

    return null;
}

/**
 * Clean a wikilink to get the note name
 * [[NoteName]] → NoteName
 * [[path/to/NoteName]] → path/to/NoteName
 * [[NoteName|alias]] → NoteName
 */
function cleanWikilink(link: string): string {
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
    }

    // Build implied next edges
    graph.buildNextMap();

    // Debug logging
    console.log('Thread graph built:', graph.toDebugObject());
}
