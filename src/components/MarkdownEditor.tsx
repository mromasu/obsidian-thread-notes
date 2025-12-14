import { EditorView, ViewUpdate } from '@codemirror/view';
import { useContext, useEffect, useRef } from 'react';
import { Platform } from 'obsidian';
import { ThreadContext } from './context';

interface MarkdownEditorProps {
    value: string;
    filePath: string;
    isCurrent?: boolean;
    onChange?: (value: string) => void;
}

/**
 * Get the MarkdownEditor class from the app's embed registry.
 * This is the same pattern used by Obsidian Kanban.
 */
export function getEditorClass(app: any) {
    const md = app.embedRegistry.embedByExtension.md(
        { app: app, containerEl: createDiv(), state: {} },
        null,
        ''
    );

    md.load();
    md.editable = true;
    md.showEditor();

    const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor;

    md.unload();

    return MarkdownEditor;
}

/**
 * Create a markdown controller object for the editor.
 */
function getMarkdownController(view: any, getEditor: () => any): Record<any, any> {
    return {
        app: view.app,
        showSearch: () => { },
        toggleMode: () => { },
        onMarkdownScroll: () => { },
        getMode: () => 'source',
        scroll: 0,
        editMode: null,
        get editor() {
            return getEditor();
        },
        get file() {
            return view.file;
        },
        get path() {
            return view.file?.path;
        },
    };
}

/**
 * Create an app proxy that customizes vault config for the editor.
 */
function getEditorAppProxy(view: any) {
    return new Proxy(view.app, {
        get(target, prop, receiver) {
            if (prop === 'vault') {
                return new Proxy(view.app.vault, {
                    get(target, prop, receiver) {
                        if (prop === 'config') {
                            return new Proxy((view.app.vault as any).config, {
                                get(target, prop, receiver) {
                                    if (['showLineNumber', 'foldHeading', 'foldIndent'].includes(prop as string)) {
                                        return false;
                                    }
                                    return Reflect.get(target, prop, receiver);
                                },
                            });
                        }
                        return Reflect.get(target, prop, receiver);
                    },
                });
            }
            return Reflect.get(target, prop, receiver);
        },
    });
}

export function MarkdownEditor({ value, filePath, isCurrent, onChange }: MarkdownEditorProps) {
    const context = useContext(ThreadContext);
    const elRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);

    useEffect(() => {
        if (!context || !elRef.current) return;

        const { view, plugin } = context;

        // Create a custom Editor class extending the base MarkdownEditor
        class Editor extends plugin.MarkdownEditor {
            isThreadEditor = true;

            updateBottomPadding() { }

            onUpdate(update: ViewUpdate, changed: boolean) {
                super.onUpdate(update, changed);
                if (changed && onChange) {
                    onChange(this.editor.getValue());
                }
            }

            buildLocalExtensions(): any[] {
                const extensions = super.buildLocalExtensions();

                // Add focus/blur handlers
                extensions.push(
                    EditorView.domEventHandlers({
                        focus: () => {
                            view.activeEditor = this.owner;
                            if (Platform.isMobile) {
                                view.contentEl.addClass('is-mobile-editing');
                            }
                            return true;
                        },
                        blur: () => {
                            if (Platform.isMobile) {
                                view.contentEl.removeClass('is-mobile-editing');
                            }
                            return true;
                        },
                    })
                );

                return extensions;
            }
        }

        const controller = getMarkdownController(view, () => editorRef.current?.editor);
        const app = getEditorAppProxy(view);
        const editor = plugin.addChild(new (Editor as any)(app, elRef.current, controller));
        const cm: EditorView = editor.cm;

        editorRef.current = editor;
        controller.editMode = editor;

        // Set initial content
        editor.set(value || '');

        return () => {
            if (Platform.isMobile) {
                if (view.activeEditor === controller) {
                    view.activeEditor = null;
                }
            }
            plugin.removeChild(editor);
            editorRef.current = null;
        };
    }, [filePath]); // Re-create editor when filePath changes

    // Update content when value prop changes (if needed)
    useEffect(() => {
        if (editorRef.current && value !== undefined) {
            const currentValue = editorRef.current.editor?.getValue() || '';
            if (currentValue !== value) {
                editorRef.current.set(value);
            }
        }
    }, [value]);

    const className = `thread-markdown-editor${isCurrent ? ' is-current-note' : ''}`;
    return <div className={className} data-path={filePath} ref={elRef}></div>;
}
