import { useState, useRef, useEffect } from 'react';
import type { Property, PropertyType } from './yamlUtils';

interface PropertyInputProps {
    property: Property;
    onChange: (value: any) => void;
    onDelete: () => void;
    onNameChange: (name: string) => void;
}

/**
 * Text input for text/wikilink properties
 */
function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="text"
            className="property-input property-text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

/**
 * Number input
 */
function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <input
            type="number"
            className="property-input property-number"
            value={value ?? 0}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
    );
}

/**
 * Checkbox input for boolean properties
 */
function CheckboxInput({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <input
            type="checkbox"
            className="property-input property-checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
        />
    );
}

/**
 * Date picker for date properties
 */
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="date"
            className="property-input property-date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

/**
 * DateTime picker for datetime properties
 */
function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="datetime-local"
            className="property-input property-datetime"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

/**
 * List/tag input with pill-style items
 */
function ListInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const items = Array.isArray(value) ? value : [];

    const addItem = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !items.includes(trimmed)) {
            onChange([...items, trimmed]);
            setInputValue('');
        }
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        onChange(newItems);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        } else if (e.key === 'Backspace' && inputValue === '' && items.length > 0) {
            removeItem(items.length - 1);
        }
    };

    return (
        <div className="property-input property-list">
            <div className="list-items">
                {items.map((item, index) => (
                    <span key={index} className="list-item-pill">
                        {item}
                        <button
                            type="button"
                            className="pill-remove"
                            onClick={() => removeItem(index)}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    className="list-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={addItem}
                    placeholder={items.length === 0 ? 'Add item...' : ''}
                />
            </div>
        </div>
    );
}

/**
 * Main property input component that renders appropriate input based on type
 */
export function PropertyInput({ property, onChange, onDelete, onNameChange }: PropertyInputProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(property.name);

    const handleNameSave = () => {
        if (nameValue.trim() && nameValue !== property.name) {
            onNameChange(nameValue.trim());
        }
        setIsEditingName(false);
    };

    const renderInput = () => {
        switch (property.type) {
            case 'checkbox':
                return <CheckboxInput value={property.value} onChange={onChange} />;
            case 'number':
                return <NumberInput value={property.value} onChange={onChange} />;
            case 'date':
                return <DateInput value={property.value} onChange={onChange} />;
            case 'datetime':
                return <DateTimeInput value={property.value} onChange={onChange} />;
            case 'list':
                return <ListInput value={property.value} onChange={onChange} />;
            default:
                return <TextInput value={property.value} onChange={onChange} />;
        }
    };

    return (
        <div className="property-row">
            <div className="property-name">
                {isEditingName ? (
                    <input
                        type="text"
                        className="property-name-input"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                        autoFocus
                    />
                ) : (
                    <span
                        className="property-name-text"
                        onClick={() => setIsEditingName(true)}
                        title="Click to rename"
                    >
                        {property.name}
                    </span>
                )}
            </div>
            <div className="property-value">
                {renderInput()}
            </div>
            <button
                type="button"
                className="property-delete"
                onClick={onDelete}
                title="Delete property"
            >
                ×
            </button>
        </div>
    );
}
