
import * as fs from 'fs';
import * as path from 'path';
import { parse, write, anonymize } from './index';
import { formatTagWithComma } from './utils/tagUtils';

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
    printHelp();
    process.exit(1);
}

async function run() {
    switch (command) {
        case 'dump':
            if (!args[1]) {
                console.error('Usage: rad-parser dump <file>');
                process.exit(1);
            }
            dumpFile(args[1]);
            break;
            
        case 'anonymize':
            if (!args[1]) {
                console.error('Usage: rad-parser anonymize <input> [output]');
                process.exit(1);
            }
            anonymizeFile(args[1], args[2]);
            break;
            
        case 'convert':
             if (!args[1] || !args[2]) {
                console.error('Usage: rad-parser convert <input> <output>');
                process.exit(1);
            }
            convertFile(args[1], args[2]);
            break;
            
        case 'help':
        case '--help':
        case '-h':
            printHelp();
            break;
            
        default:
            console.error(`Unknown command: ${command}`);
            printHelp();
            process.exit(1);
    }
}

function printHelp() {
    console.log(`
rad-parser CLI v2.0.0

Commands:
  dump <file>                  Parse and print DICOM tags from a file.
  anonymize <input> [output]   Anonymize a DICOM file.
                               If output is omitted, defaults to <input>_anon.dcm.
  convert <input> <output>     Convert/Rewrite a DICOM file (e.g. to Explicit VR Little Endian).
    `);
}

function dumpFile(filePath: string) {
    try {
        const buffer = fs.readFileSync(filePath);
        const dataset = parse(new Uint8Array(buffer), { type: 'full' });
        
        console.log(`\nParsed ${filePath}:`);
        console.log(`Total Tags: ${Object.keys(dataset.dict).length}`);
        console.log('-'.repeat(50));
        
        // Sort tags
        const sortedTags = Object.keys(dataset.dict).sort();
        
        for (const tag of sortedTags) {
            const element = dataset.dict[tag];
            const tagName = formatTagWithComma(tag);
            const vr = element.vr || 'UN';
            let value = element.Value;
            
            // Format value for display
            if (value instanceof Uint8Array) {
                value = `[Binary Data: ${value.length} bytes]`;
            } else if (value instanceof Uint8Array || (Array.isArray(value) && value[0] instanceof Uint8Array)) {
                 value = `[Binary Data / Fragments]`;
            } else if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value);
            }
            
            // Truncate long values
            let displayValue = String(value);
            if (displayValue.length > 50) {
                displayValue = displayValue.substring(0, 47) + '...';
            }
            
            console.log(`${tagName} [${vr}] : ${displayValue}`);
        }
        console.log('-'.repeat(50));
        
    } catch (e: any) {
        console.error(`Error parsing file: ${e.message}`);
        process.exit(1);
    }
}

function anonymizeFile(inputPath: string, outputPath?: string) {
    try {
        if (!outputPath) {
            const ext = path.extname(inputPath);
            const base = path.basename(inputPath, ext);
            outputPath = path.join(path.dirname(inputPath), `${base}_anon${ext}`);
        }
        
        const buffer = fs.readFileSync(inputPath);
        const dataset = parse(new Uint8Array(buffer), { type: 'full' });
        
        console.log(`Anonymizing ${inputPath}...`);
        const anonDataset = anonymize(dataset);
        
        console.log(`Writing to ${outputPath}...`);
        const outBytes = write(anonDataset);
        
        fs.writeFileSync(outputPath, outBytes);
        console.log('Done.');
        
    } catch (e: any) {
         console.error(`Error anonymizing file: ${e.message}`);
         process.exit(1);
    }
}

function convertFile(inputPath: string, outputPath: string) {
    try {
        const buffer = fs.readFileSync(inputPath);
        console.log(`Reading ${inputPath}...`);
        const dataset = parse(new Uint8Array(buffer), { type: 'full' });
        
        console.log(`Writing to ${outputPath}...`);
        const outBytes = write(dataset);
        
        fs.writeFileSync(outputPath, outBytes);
        console.log('Done.');
        
    } catch (e: any) {
         console.error(`Error converting file: ${e.message}`);
         process.exit(1);
    }
}

// export main for testing if needed
export { run };

// Run if main
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
