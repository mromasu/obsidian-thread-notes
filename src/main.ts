import { around } from 'monkey-around';
import {
	App,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	ViewState,
	WorkspaceLeaf,
} from 'obsidian';
import { ThreadView, THREAD_VIEW_TYPE } from './views/ThreadView';
import { getEditorClass } from './components/MarkdownEditor';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	MarkdownEditor: any = null;

	// Track file view modes: leafId => 'thread' | 'markdown'
	fileModes: Record<string, string> = {};

	async onload() {
		await this.loadSettings();

		// Get the MarkdownEditor class from the app's embed registry
		this.MarkdownEditor = getEditorClass(this.app);

		// Register the Thread view
		this.registerView(THREAD_VIEW_TYPE, (leaf) => new ThreadView(leaf, this));

		// Register monkey patches for view interception
		this.registerMonkeyPatches();

		// Listen to layout events to replace markdown leaves
		this.registerLayoutEvents();

		// Add command to toggle between Thread and markdown views
		this.addCommand({
			id: 'toggle-thread-view',
			name: 'Toggle Thread view',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return false;

				if (checking) return true;

				const activeView = this.app.workspace.getActiveViewOfType(ThreadView);
				if (activeView) {
					this.fileModes[(activeView.leaf as any).id || activeFile.path] = 'markdown';
					this.setMarkdownView(activeView.leaf);
				} else {
					const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (markdownView) {
						this.fileModes[(markdownView.leaf as any).id || activeFile.path] = THREAD_VIEW_TYPE;
						this.setThreadView(markdownView.leaf);
					}
				}
			},
		});

		// Add settings tab
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
		// Convert all Thread views back to markdown on unload
		this.app.workspace.getLeavesOfType(THREAD_VIEW_TYPE).forEach((leaf) => {
			this.fileModes[(leaf as any).id] = 'markdown';
			this.setMarkdownView(leaf);
		});

		this.MarkdownEditor = null;
		this.fileModes = {};
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Set a leaf to Thread view
	 */
	async setThreadView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: THREAD_VIEW_TYPE,
			state: leaf.view.getState(),
			popstate: true,
		} as ViewState);
	}

	/**
	 * Set a leaf to markdown view
	 */
	async setMarkdownView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: 'markdown',
			state: leaf.view.getState(),
			popstate: true,
		} as ViewState);
	}

	/**
	 * Replace all markdown leaves with Thread views
	 */
	replaceMarkdownLeaves() {
		// Get all leaves and check if they are markdown type
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const state = leaf.view.getState();
				const leafId = (leaf as any).id || state?.file;

				// Only replace if not explicitly set to markdown mode
				if (this.fileModes[leafId] !== 'markdown') {
					this.fileModes[leafId] = THREAD_VIEW_TYPE;
					this.setThreadView(leaf);
				}
			}
		});
	}

	/**
	 * Register layout events to replace markdown leaves
	 */
	registerLayoutEvents() {
		// On layout ready, replace all markdown leaves
		this.app.workspace.onLayoutReady(() => {
			this.replaceMarkdownLeaves();
		});

		// On layout change, check for new markdown leaves
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.replaceMarkdownLeaves();
			})
		);
	}

	/**
	 * Register monkey patches to intercept markdown view creation
	 */
	registerMonkeyPatches() {
		const self = this;

		// Monkey patch WorkspaceLeaf.setViewState to intercept markdown views
		this.register(
			around(WorkspaceLeaf.prototype, {
				// Clean up file modes when leaf is detached
				detach(next) {
					return function (this: WorkspaceLeaf) {
						const state = this.view?.getState();
						if (state?.file && self.fileModes[(this as any).id || state.file]) {
							delete self.fileModes[(this as any).id || state.file];
						}
						return next.apply(this);
					};
				},

				// Intercept setViewState to replace markdown with Thread
				setViewState(next) {
					return function (this: WorkspaceLeaf, state: ViewState, ...rest: any[]) {
						// If trying to open a markdown view
						if (
							state.type === 'markdown' &&
							state.state?.file &&
							// And it's not explicitly set to markdown mode
							self.fileModes[(this as any).id || state.state.file] !== 'markdown'
						) {
							// Replace with Thread view
							const newState: ViewState = {
								...state,
								type: THREAD_VIEW_TYPE,
							};
							self.fileModes[(this as any).id || state.state.file] = THREAD_VIEW_TYPE;
							return next.apply(this, [newState, ...rest]);
						}

						return next.apply(this, [state, ...rest]);
					};
				},
			})
		);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
