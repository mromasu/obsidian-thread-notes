import { App, Modal, Setting } from 'obsidian';
import { PropertyType, getDefaultValue } from './yamlUtils';

export interface AddPropertyResult {
    name: string;
    type: PropertyType;
    value: any;
}

/**
 * Modal for adding a new property
 */
export class AddPropertyModal extends Modal {
    private name: string = '';
    private type: PropertyType = 'text';
    private onSubmit: (result: AddPropertyResult | null) => void;

    constructor(app: App, onSubmit: (result: AddPropertyResult | null) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('add-property-modal');

        contentEl.createEl('h2', { text: 'Add property' });

        new Setting(contentEl)
            .setName('Property name')
            .addText(text => {
                text
                    .setPlaceholder('Enter property name')
                    .onChange(value => {
                        this.name = value;
                    });
                text.inputEl.focus();
            });

        new Setting(contentEl)
            .setName('Property type')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('text', 'Text')
                    .addOption('number', 'Number')
                    .addOption('checkbox', 'Checkbox')
                    .addOption('date', 'Date')
                    .addOption('datetime', 'Date & Time')
                    .addOption('list', 'List')
                    .setValue(this.type)
                    .onChange(value => {
                        this.type = value as PropertyType;
                    });
            });

        new Setting(contentEl)
            .addButton(btn => {
                btn
                    .setButtonText('Add')
                    .setCta()
                    .onClick(() => {
                        if (this.name.trim()) {
                            this.onSubmit({
                                name: this.name.trim(),
                                type: this.type,
                                value: getDefaultValue(this.type),
                            });
                            this.close();
                        }
                    });
            })
            .addButton(btn => {
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.onSubmit(null);
                        this.close();
                    });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
