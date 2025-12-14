import { ThreadContext, ThreadContextValue } from './context';
import { MarkdownEditor } from './MarkdownEditor';

interface ThreadContainerProps {
    context: ThreadContextValue;
    content: string;
    onContentChange: (content: string) => void;
}

export function ThreadContainer({ context, content, onContentChange }: ThreadContainerProps) {
    return (
        <ThreadContext.Provider value={context}>
            <div className="thread-view-container">
                <MarkdownEditor value={content} onChange={onContentChange} />
            </div>
        </ThreadContext.Provider>
    );
}
