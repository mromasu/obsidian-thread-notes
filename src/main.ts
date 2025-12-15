import { around } from 'monkey-around';
import {
	App,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	ViewState,
	WorkspaceLeaf,
	TFolder,
	AbstractInputSuggest,
} from 'obsidian';
import { ThreadView, THREAD_VIEW_TYPE } from './views/ThreadView';
import { getEditorClass } from './components/MarkdownEditor';
import { ThreadGraph, buildGraph } from './graph';
import { ChainInsertionService } from './services/ChainInsertionService';

interface MyPluginSettings {
	mySetting: string;
	/** Enable chain insertion via empty lines */
	enableChainInsertion: boolean;
	/** Number of empty lines to trigger insertion */
	insertionLineThreshold: number;
	/** Folder for new notes created via chain insertion */
	insertionFolder: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	enableChainInsertion: true,
	insertionLineThreshold: 5,
	insertionFolder: '',
};

/**
 * Folder suggestor for text input
 */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((folder) => {
			if (
				folder instanceof TFolder &&
				folder.path.toLowerCase().contains(lowerCaseInputStr)
			) {
				folders.push(folder);
			}
		});

		return folders.slice(0, 20); // Limit suggestions
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || '/');
	}

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.inputEl.trigger('input');
		this.close();
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	MarkdownEditor: any = null;

	// Thread graph for tracking prev/next relationships
	graph: ThreadGraph = new ThreadGraph();

	// Chain insertion service
	insertionService: ChainInsertionService;

	// Track file view modes: leafId => 'thread' | 'markdown'
	fileModes: Record<string, string> = {};

	async onload() {
		await this.loadSettings();

		// Build the thread graph on layout ready (after metadata cache is populated)
		this.app.workspace.onLayoutReady(() => {
			buildGraph(this.app, this.graph);
		});

		// Initialize chain insertion service
		this.insertionService = new ChainInsertionService(
			this.app,
			this.graph,
			() => this.refreshActiveThreadViews(),
			() => this.settings.insertionFolder
		);

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

		// Add command to toggle properties visibility
		this.addCommand({
			id: 'toggle-properties',
			name: 'Toggle properties panel',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(ThreadView);
				if (!activeView) return false;

				if (checking) return true;

				activeView.togglePropertiesVisibility();
			},
		});

		// Add command to add a new property
		this.addCommand({
			id: 'add-property',
			name: 'Add property',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(ThreadView);
				if (!activeView) return false;

				if (checking) return true;

				// Trigger inline add form (opens properties panel if hidden)
				activeView.triggerAddPropertyForm();
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

	/**
	 * Refresh all active Thread views after graph changes
	 */
	refreshActiveThreadViews() {
		this.app.workspace.getLeavesOfType(THREAD_VIEW_TYPE).forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof ThreadView && view.file) {
				// Re-trigger the view to reload data
				view.setViewData(view.data, false);
			}
		});
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

		containerEl.createEl('h2', { text: 'Chain insertion' });

		new Setting(containerEl)
			.setName('Enable chain insertion')
			.setDesc('Create new notes in the chain when entering empty lines at editor end')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableChainInsertion)
				.onChange(async (value) => {
					this.plugin.settings.enableChainInsertion = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Insertion trigger threshold')
			.setDesc('Number of empty lines at end to trigger insertion (default: 5)')
			.addSlider(slider => slider
				.setLimits(3, 10, 1)
				.setValue(this.plugin.settings.insertionLineThreshold)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.insertionLineThreshold = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Notes folder')
			.setDesc('Folder for new notes created via chain insertion (leave empty for vault root)')
			.addText(text => {
				text
					.setPlaceholder('e.g., Threads')
					.setValue(this.plugin.settings.insertionFolder)
					.onChange(async (value) => {
						this.plugin.settings.insertionFolder = value;
						await this.plugin.saveSettings();
					});
				// Add folder suggestions
				new FolderSuggest(this.app, text.inputEl);
			});

		containerEl.createEl('h2', { text: 'Other settings' });

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
