/**
 * YAML utilities for parsing and serializing frontmatter properties
 */

export type PropertyType = 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'list';

export interface Property {
    name: string;
    value: any;
    type: PropertyType;
}

/**
 * Detect property type from value
 */
export function detectType(value: any): PropertyType {
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'string') {
        // DateTime: YYYY-MM-DDTHH:mm
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'datetime';
        // Date: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    }
    return 'text';
}

/**
 * Parse YAML frontmatter string to Property array
 * Simple parser that handles common cases
 */
export function parseFrontmatter(yaml: string): Property[] {
    const properties: Property[] = [];
    if (!yaml.trim()) return properties;

    // Remove --- delimiters
    const content = yaml.replace(/^---\r?\n/, '').replace(/\r?\n---\r?\n?$/, '');
    const lines = content.split('\n');

    let currentKey: string | null = null;
    let currentList: string[] = [];
    let inList = false;

    for (const line of lines) {
        // List item
        if (inList && /^\s+-\s+/.test(line)) {
            const item = line.replace(/^\s+-\s+/, '').trim();
            // Remove quotes if present
            const cleanItem = item.replace(/^["']|["']$/g, '');
            currentList.push(cleanItem);
            continue;
        }

        // New key-value pair
        const keyMatch = line.match(/^([^:]+):\s*(.*)$/);
        if (keyMatch) {
            // Save previous list if any
            if (inList && currentKey) {
                properties.push({
                    name: currentKey,
                    value: currentList,
                    type: 'list',
                });
                currentList = [];
                inList = false;
            }

            const key = keyMatch[1].trim();
            let rawValue = keyMatch[2].trim();

            // Check if this starts a list
            if (rawValue === '' || rawValue === '[]') {
                currentKey = key;
                inList = true;
                currentList = [];
                continue;
            }

            // Inline list: [item1, item2]
            if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
                const items = rawValue.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                properties.push({
                    name: key,
                    value: items.filter(i => i),
                    type: 'list',
                });
                continue;
            }

            // Parse value
            let value: any = rawValue;

            // Remove quotes
            if ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
                (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
                value = rawValue.slice(1, -1);
            }
            // Boolean
            else if (rawValue === 'true') value = true;
            else if (rawValue === 'false') value = false;
            // Number
            else if (/^-?\d+(\.\d+)?$/.test(rawValue)) value = parseFloat(rawValue);
            // Wikilink - keep as string
            else if (rawValue.startsWith('[[') && rawValue.endsWith(']]')) {
                value = rawValue;
            }

            properties.push({
                name: key,
                value,
                type: detectType(value),
            });
        }
    }

    // Save final list if any
    if (inList && currentKey) {
        properties.push({
            name: currentKey,
            value: currentList,
            type: 'list',
        });
    }

    return properties;
}

/**
 * Check if a string needs to be quoted in YAML
 */
function needsQuotes(value: string): boolean {
    // Needs quotes if contains special chars or looks like other types
    if (/^[\[\]{}>|*&!%#@`]/.test(value)) return true;
    if (/:\s/.test(value)) return true;
    if (value.includes('#')) return true;
    if (value.startsWith("'") || value.startsWith('"')) return true;
    // Don't quote wikilinks
    if (value.startsWith('[[') && value.endsWith(']]')) return false;
    return false;
}

/**
 * Serialize a single property value to YAML
 */
function serializeValue(prop: Property): string {
    switch (prop.type) {
        case 'checkbox':
            return prop.value ? 'true' : 'false';
        case 'number':
            return String(prop.value);
        case 'date':
        case 'datetime':
            return prop.value || '';
        case 'list':
            if (!Array.isArray(prop.value) || prop.value.length === 0) {
                return '';
            }
            return '\n' + prop.value.map((v: string) => `  - ${v}`).join('\n');
        default:
            const strValue = String(prop.value);
            return needsQuotes(strValue) ? `"${strValue}"` : strValue;
    }
}

/**
 * Serialize Property array back to YAML frontmatter string
 */
export function serializeFrontmatter(properties: Property[]): string {
    if (properties.length === 0) return '';

    const lines = properties.map(prop => {
        const value = serializeValue(prop);
        return `${prop.name}: ${value}`;
    });

    return `---\n${lines.join('\n')}\n---\n`;
}

/**
 * Get default value for a property type
 */
export function getDefaultValue(type: PropertyType): any {
    switch (type) {
        case 'checkbox': return false;
        case 'number': return 0;
        case 'date': return new Date().toISOString().split('T')[0];
        case 'datetime': return new Date().toISOString().slice(0, 16);
        case 'list': return [];
        default: return '';
    }
}
