import { ThreadContext, ThreadContextValue } from './context';
import { MarkdownEditor } from './MarkdownEditor';
import { PropertyEditor } from './PropertyEditor';
import type { Property } from './yamlUtils';
import type { ThreadData, ThreadChain, NoteContent } from '../views/types';

interface ThreadContainerProps {
    context: ThreadContextValue;
    threadData: ThreadData;
    currentNoteProperties: Property[];
    onContentChange: (body: string, filePath: string) => void;
    onPropertiesChange: (properties: Property[]) => void;
    /** Trigger counter to open add property form (increment to trigger) */
    triggerAddPropertyForm?: number;
    /** Callback when add form state changes */
    onAddFormChange?: (isOpen: boolean) => void;
}

/**
 * Render a single chain of notes
 */
function ChainRenderer({
    chain,
    currentPath,
    onContentChange,
}: {
    chain: ThreadChain;
    currentPath: string;
    onContentChange: (body: string, filePath: string) => void;
}) {
    return (
        <>
            {chain.notes.map((note) => (
                <MarkdownEditor
                    key={note.path}
                    value={note.body}
                    filePath={note.path}
                    isCurrent={note.path === currentPath}
                    onChange={(value) => onContentChange(value, note.path)}
                />
            ))}
        </>
    );
}

export function ThreadContainer({
    context,
    threadData,
    currentNoteProperties,
    onContentChange,
    onPropertiesChange,
    triggerAddPropertyForm,
    onAddFormChange,
}: ThreadContainerProps) {
    const hasReplies = threadData.replyChains.length > 0;

    return (
        <ThreadContext.Provider value={context}>
            <div className="thread-view-container">
                {/* Property editor for current note */}
                <PropertyEditor
                    properties={currentNoteProperties}
                    onChange={onPropertiesChange}
                    triggerAddForm={triggerAddPropertyForm}
                    onAddFormChange={onAddFormChange}
                />

                {/* Main thread chain */}
                <div className="main-thread-chain">
                    <ChainRenderer
                        chain={threadData.mainChain}
                        currentPath={threadData.currentPath}
                        onContentChange={onContentChange}
                    />
                </div>

                {/* Reply chains */}
                {hasReplies && (
                    <div className="reply-chains">
                        {threadData.replyChains.map((chain, index) => (
                            <div key={chain.notes[0]?.path ?? index} className="reply-chain">
                                <div className="reply-chain-divider">
                                    <span className="reply-chain-label">Reply</span>
                                </div>
                                <ChainRenderer
                                    chain={chain}
                                    currentPath={threadData.currentPath}
                                    onContentChange={onContentChange}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ThreadContext.Provider>
    );
}

