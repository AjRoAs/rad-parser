
import { describe, it, expect } from 'vitest';
import { parse, anonymize } from '../src/index';

describe('Anonymizer', () => {
    // Create a mock dataset
    const createDataset = () => {
        return {
            dict: {
                'x00100010': { vr: 'PN', Value: 'DOE^JOHN', value: 'DOE^JOHN' }, // PatientName
                'x00100020': { vr: 'LO', Value: '12345', value: '12345' },       // PatientID
                'x00100030': { vr: 'DA', Value: '19800101', value: '19800101' }, // PatientBirthDate
                'x00100040': { vr: 'CS', Value: 'M', value: 'M' },               // PatientSex
                // Private Tag (odd group)
                'x00110010': { vr: 'LO', Value: 'PrivateData', value: 'PrivateData' }
            },
            elements: {}, // Mock alias
            string: (t: string) => undefined,
            uint16: (t: string) => undefined,
            int16: (t: string) => undefined,
            floatString: (t: string) => undefined,
        } as any;
    };

    it('should anonymize sensitive tags by default', () => {
        const dataset = createDataset();
        const anon = anonymize(dataset);
        
        expect(anon.dict['x00100010'].Value).toBe('ANONYMIZED'); // PatientName
        expect(anon.dict['x00100030'].Value).toBe('');           // PatientBirthDate
        expect(anon.dict['x00100040'].Value).toBe('');           // PatientSex
    });

    it('should replace PatientID if not provided', () => {
        const dataset = createDataset();
        const anon = anonymize(dataset);
        
        // Should generate fake ID
        expect(anon.dict['x00100020'].Value).toMatch(/^ANON-\d+/); // Default prefix ANON-
    });

    it('should use custom replacements', () => {
        const dataset = createDataset();
        const anon = anonymize(dataset, {
            replacements: {
                'x00100010': 'SMITH^JANE',
                'x00100020': 'ID-999'
            }
        });
        
        expect(anon.dict['x00100010'].Value).toBe('SMITH^JANE');
        expect(anon.dict['x00100020'].Value).toBe('ID-999');
    });

    it('should remove tags if replacement is null', () => {
        const dataset = createDataset();
        const anon = anonymize(dataset, {
            replacements: {
                'x00100010': null // Remove PatientName
            }
        });
        
        expect(anon.dict['x00100010']).toBeUndefined();
    });

    it('should remove private tags by default', () => {
        const dataset = createDataset();
        const anon = anonymize(dataset);
        
        expect(anon.dict['x00110010']).toBeUndefined();
    });

    it('should keep private tags if requested', () => {
        const dataset = createDataset();
        const anon = anonymize(dataset, { keepPrivateTags: true });
        
        expect(anon.dict['x00110010']).toBeDefined();
        expect(anon.dict['x00110010'].Value).toBe('PrivateData');
    });
});
