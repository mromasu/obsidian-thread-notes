import { createContext } from 'react';
import { App } from 'obsidian';
import type { ThreadView } from '../views/ThreadView';
import type MyPlugin from '../main';

export interface ThreadContextValue {
    app: App;
    view: ThreadView;
    plugin: MyPlugin;
}

export const ThreadContext = createContext<ThreadContextValue | null>(null);
