import { useState } from 'react';
import { PropertyInput } from './PropertyInput';
import { Property, PropertyType, getDefaultValue } from './yamlUtils';

interface PropertyEditorProps {
    properties: Property[];
    onChange: (properties: Property[]) => void;
}

/**
 * Add property modal/form
 */
function AddPropertyForm({
    onAdd,
    onCancel,
}: {
    onAdd: (name: string, type: PropertyType) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<PropertyType>('text');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onAdd(name.trim(), type);
        }
    };

    return (
        <form className="add-property-form" onSubmit={handleSubmit}>
            <input
                type="text"
                className="add-property-name"
                placeholder="Property name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
            />
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
export function PropertyEditor({ properties, onChange }: PropertyEditorProps) {
    const [isAdding, setIsAdding] = useState(false);

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
        // Check if property already exists
        if (properties.some(p => p.name === name)) {
            setIsAdding(false);
            return;
        }

        const newProperty: Property = {
            name,
            type,
            value: getDefaultValue(type),
        };
        onChange([...properties, newProperty]);
        setIsAdding(false);
    };

    return (
        <div className="property-editor">
            <div className="property-editor-header">
                <span className="property-editor-title">Properties</span>
                <button
                    type="button"
                    className="property-add-button"
                    onClick={() => setIsAdding(true)}
                    title="Add property"
                >
                    +
                </button>
            </div>

            {isAdding && (
                <AddPropertyForm
                    onAdd={handleAddProperty}
                    onCancel={() => setIsAdding(false)}
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
