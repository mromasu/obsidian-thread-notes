import { useState, useEffect, useRef } from 'react';
import { App, setIcon } from 'obsidian';
import { PropertyInput } from './PropertyInput';
import { Property, PropertyType, getDefaultValue } from './yamlUtils';

interface PropertyEditorProps {
    properties: Property[];
    onChange: (properties: Property[]) => void;
    /** External trigger counter to open add form (increment to trigger) */
    triggerAddForm?: number;
    /** Callback when add form is opened/closed */
    onAddFormChange?: (isOpen: boolean) => void;
    /** Obsidian App instance for suggestions */
    app?: App;
}

interface PropertySuggestion {
    name: string;
    type: PropertyType;
}

/**
 * Get Lucide icon name for property type
 */
function getTypeIconName(type: PropertyType): string {
    switch (type) {
        case 'text': return 'text';
        case 'number': return 'hash';
        case 'checkbox': return 'check-square';
        case 'date': return 'calendar';
        case 'datetime': return 'clock';
        case 'list': return 'list';
        default: return 'text';
    }
}

/**
 * Icon component that uses Obsidian's setIcon
 */
function Icon({ name, className }: { name: string; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.empty();
            setIcon(ref.current, name);
        }
    }, [name]);

    return <span ref={ref} className={className} />;
}

/**
 * Infer property type from its actual value
 */
function inferTypeFromValue(value: any): PropertyType {
    if (value === null || value === undefined) return 'text';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'string') {
        // Check datetime pattern: YYYY-MM-DDTHH:mm
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'datetime';
        // Check date pattern: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    }
    return 'text';
}

/**
 * Get all vault properties by scanning file frontmatter (metadatamenu approach)
 */
function getVaultProperties(app: App): PropertySuggestion[] {
    try {
        const propertyMap = new Map<string, PropertyType>();

        // Scan all markdown files
        const files = app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = app.metadataCache.getFileCache(file);
            const fm = cache?.frontmatter;
            if (!fm) continue;

            for (const [key, value] of Object.entries(fm)) {
                // Skip internal frontmatter fields
                if (key === 'position') continue;

                // Only set type if we haven't seen this property before
                // This gives priority to first occurrence
                if (!propertyMap.has(key)) {
                    propertyMap.set(key, inferTypeFromValue(value));
                }
            }
        }

        return Array.from(propertyMap.entries())
            .map(([name, type]) => ({ name, type }))
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.warn('Failed to get vault properties:', e);
        return [];
    }
}

/**
 * Add property form with suggestions
 */
function AddPropertyForm({
    onAdd,
    onCancel,
    existingPropertyNames,
    app,
}: {
    onAdd: (name: string, type: PropertyType) => void;
    onCancel: () => void;
    existingPropertyNames: string[];
    app?: App;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<PropertyType>('text');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Load vault properties on mount
    useEffect(() => {
        if (app) {
            const vaultProps = getVaultProperties(app);
            setSuggestions(vaultProps);
        }
    }, [app]);

    // Filter suggestions based on input and exclude existing properties
    const filteredSuggestions = suggestions.filter(s => {
        if (existingPropertyNames.includes(s.name)) return false;
        if (!name.trim()) return true;
        return s.name.toLowerCase().includes(name.toLowerCase());
    }).slice(0, 10);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedIndex >= 0 && suggestionsRef.current) {
            const selectedEl = suggestionsRef.current.children[selectedIndex] as HTMLElement;
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onAdd(name.trim(), type);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (showSuggestions && filteredSuggestions.length > 0) {
                setShowSuggestions(false);
            } else {
                e.preventDefault();
                onCancel();
            }
            return;
        }

        if (!showSuggestions || filteredSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            const selected = filteredSuggestions[selectedIndex];
            setName(selected.name);
            setType(selected.type);
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
    };

    const handleSuggestionClick = (suggestion: PropertySuggestion) => {
        setName(suggestion.name);
        setType(suggestion.type);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    return (
        <form className="add-property-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
            <div className="property-name-wrapper">
                <input
                    ref={inputRef}
                    type="text"
                    className="add-property-name"
                    placeholder="Property name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setShowSuggestions(true);
                        setSelectedIndex(-1);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    autoFocus
                    autoComplete="off"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="property-suggestions" ref={suggestionsRef}>
                        {filteredSuggestions.map((suggestion, index) => (
                            <div
                                key={suggestion.name}
                                className={`property-suggestion ${index === selectedIndex ? 'selected' : ''}`}
                                onMouseDown={() => handleSuggestionClick(suggestion)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <Icon name={getTypeIconName(suggestion.type)} className="suggestion-icon" />
                                <span className="suggestion-name">{suggestion.name}</span>
                                <span className="suggestion-type">{suggestion.type}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <select
                className="add-property-type"
                value={type}
                onChange={(e) => setType(e.target.value as PropertyType)}
            >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="checkbox">Checkbox</option>
                <option value="date">Date</option>
                <option value="datetime">Date & Time</option>
                <option value="list">List</option>
            </select>
            <button type="submit" className="add-property-submit">Add</button>
            <button type="button" className="add-property-cancel" onClick={onCancel}>Cancel</button>
        </form>
    );
}

/**
 * Main property editor component
 */
export function PropertyEditor({
    properties,
    onChange,
    triggerAddForm,
    onAddFormChange,
    app,
}: PropertyEditorProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [lastTrigger, setLastTrigger] = useState(0);

    // React to external trigger to open add form
    useEffect(() => {
        if (triggerAddForm && triggerAddForm > lastTrigger) {
            setLastTrigger(triggerAddForm);
            setIsAdding(true);
            onAddFormChange?.(true);
        }
    }, [triggerAddForm]);

    const handleSetIsAdding = (value: boolean) => {
        setIsAdding(value);
        onAddFormChange?.(value);
    };

    const handlePropertyChange = (index: number, value: any) => {
        const newProperties = [...properties];
        newProperties[index] = { ...newProperties[index], value };
        onChange(newProperties);
    };

    const handlePropertyNameChange = (index: number, name: string) => {
        const newProperties = [...properties];
        newProperties[index] = { ...newProperties[index], name };
        onChange(newProperties);
    };

    const handlePropertyDelete = (index: number) => {
        const newProperties = properties.filter((_, i) => i !== index);
        onChange(newProperties);
    };

    const handleAddProperty = (name: string, type: PropertyType) => {
        if (properties.some(p => p.name === name)) {
            handleSetIsAdding(false);
            return;
        }

        const newProperty: Property = {
            name,
            type,
            value: getDefaultValue(type),
        };
        onChange([...properties, newProperty]);
        handleSetIsAdding(false);
    };

    const existingPropertyNames = properties.map(p => p.name);

    return (
        <div className="property-editor">
            <div className="property-editor-header">
                <span className="property-editor-title">Properties</span>
                <button
                    type="button"
                    className="property-add-button"
                    onClick={() => handleSetIsAdding(true)}
                    title="Add property"
                >
                    +
                </button>
            </div>

            {isAdding && (
                <AddPropertyForm
                    onAdd={handleAddProperty}
                    onCancel={() => handleSetIsAdding(false)}
                    existingPropertyNames={existingPropertyNames}
                    app={app}
                />
            )}

            <div className="property-list">
                {properties.map((property, index) => (
                    <PropertyInput
                        key={`${property.name}-${index}`}
                        property={property}
                        onChange={(value) => handlePropertyChange(index, value)}
                        onDelete={() => handlePropertyDelete(index)}
                        onNameChange={(name) => handlePropertyNameChange(index, name)}
                    />
                ))}
            </div>

            {properties.length === 0 && !isAdding && (
                <div className="property-empty">
                    No properties. Click + to add one.
                </div>
            )}
        </div>
    );
}
