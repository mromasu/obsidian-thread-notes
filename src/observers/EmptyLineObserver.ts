/**
 * EmptyLineObserver - CodeMirror extension that detects consecutive empty lines
 * 
 * When the configured threshold of empty lines at the end of the document is
 * detected, it triggers a callback for chain insertion.
 */

import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';

export interface EmptyLineObserverConfig {
    /** Number of empty lines at end to trigger (default: 5) */
    threshold: number;
    /** Callback when trigger is detected */
    onTrigger: (view: EditorView, filePath: string) => void;
    /** Get the file path for the current editor */
    getFilePath: () => string | null;
    /** Debounce delay in ms (default: 300) */
    debounceMs?: number;
}

/**
 * Count consecutive empty lines at the end of the document
 */
function countEmptyLinesAtEnd(content: string): number {
    if (!content) return 0;

    let count = 0;
    let i = content.length - 1;

    // Skip trailing whitespace on last line
    while (i >= 0 && content[i] === ' ') {
        i--;
    }

    // Count newlines
    while (i >= 0) {
        if (content[i] === '\n') {
            count++;
            i--;
            // Skip \r if present (Windows line endings)
            if (i >= 0 && content[i] === '\r') {
                i--;
            }
        } else if (content[i] === ' ' || content[i] === '\t') {
            // Empty line can have whitespace
            i--;
        } else {
            // Found non-whitespace content
            break;
        }
    }

    return count;
}

/**
 * Create a CodeMirror ViewPlugin that observes for empty line patterns
 */
export function createEmptyLineObserver(config: EmptyLineObserverConfig) {
    const debounceMs = config.debounceMs ?? 300;

    return ViewPlugin.fromClass(
        class {
            private debounceTimer: ReturnType<typeof setTimeout> | null = null;
            private triggered = false;

            constructor(private view: EditorView) { }

            update(update: ViewUpdate) {
                // Only check on document changes
                if (!update.docChanged) return;

                // Debounce to avoid triggering on every keystroke
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                }

                this.debounceTimer = setTimeout(() => {
                    this.checkTrigger();
                }, debounceMs);
            }

            private checkTrigger() {
                const content = this.view.state.doc.toString();
                const emptyLineCount = countEmptyLinesAtEnd(content);

                if (emptyLineCount >= config.threshold && !this.triggered) {
                    this.triggered = true;

                    const filePath = config.getFilePath();
                    if (filePath) {
                        console.log('[EmptyLineObserver] Trigger detected, empty lines:', emptyLineCount);

                        // Remove extra empty lines (keep 1)
                        this.cleanupEmptyLines();

                        // Trigger the callback
                        config.onTrigger(this.view, filePath);
                    }
                } else if (emptyLineCount < config.threshold) {
                    // Reset trigger state when user removes empty lines
                    this.triggered = false;
                }
            }

            private cleanupEmptyLines() {
                const content = this.view.state.doc.toString();

                // Find where to trim from
                let trimFrom = content.length;
                let newlineCount = 0;

                for (let i = content.length - 1; i >= 0; i--) {
                    if (content[i] === '\n') {
                        newlineCount++;
                        if (newlineCount > 1) {
                            trimFrom = i + 1;
                        }
                    } else if (content[i] !== '\r' && content[i] !== ' ' && content[i] !== '\t') {
                        break;
                    }
                }

                // Keep only 1 trailing newline
                if (trimFrom < content.length) {
                    this.view.dispatch({
                        changes: {
                            from: trimFrom,
                            to: content.length,
                            insert: '\n',
                        },
                    });
                }
            }

            destroy() {
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                }
            }
        }
    );
}
