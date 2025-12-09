# RAD-Parser

**RAD-Parser** is a lightweight, performant, self-contained DICOM parser implementation with zero external dependencies. Designed for safety, efficiency, and reliability in medical imaging applications.

[![npm version](https://img.shields.io/npm/v/rad-parser.svg)](https://www.npmjs.com/package/rad-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

-   ✅ **Zero Dependencies**: Pure TypeScript/JavaScript implementation using only native APIs
-   ✅ **Serialization**: Write/Convert DICOM files (Explicit VR Little Endian)
-   ✅ **Anonymization**: Built-in anonymization utilities
-   ✅ **CLI Utility**: Command line tool for dumping, converting, and anonymizing DICOM files
-   ✅ **Plugin System**: Extensible architecture for Codecs and Pixel Data decoding
-   ✅ **Safe & Performant**: efficient binary parsing with bounds checking
-   ✅ **DICOM Part 10 Support**: Handles both Part 10 and non-Part 10 DICOM files

## Installation

```bash
npm install rad-parser
```

## CLI Usage

rad-parser comes with a built-in CLI for common operations:

```bash
# Dump tags
npx rad-parser dump file.dcm

# Anonymize file
npx rad-parser anonymize input.dcm output_anon.dcm

# Convert/Rewrite file
npx rad-parser convert input.dcm output_clean.dcm
```

## Usage

### Parsing

```typescript
import { parse } from "rad-parser";

const dataset = parse(byteArray);

// string access
const name = dataset.string("x00100010");

// direct element access
const element = dataset.dict["x00100010"];
console.log(element.Value);
```

### Anonymization

```typescript
import { parse, anonymize, write } from "rad-parser";

const dataset = parse(inputBytes);

// Anonymize (default rules)
const anonDataset = anonymize(dataset);

// Custom rules
const customAnon = anonymize(dataset, {
    replacements: {
        x00100010: "JOHN^DOE",
    },
});

// Write to buffer
const outputBytes = write(customAnon);
```

### Serialization (Writer)

```typescript
import { write } from "rad-parser";

// Serialize dataset to Uint8Array (Part 10 format)
const bytes = write(dataset);
```

## Architecture (v2.0.0)

The project is organized into core components:

-   `src/core`: Main logic (parser, writer, anonymizer).
-   `src/utils`: Helper functions (tag utils, dictionary, validation).
-   `src/plugins`: Interface for extensions (codecs, WebGPU).

## Contributing

RAD-Parser is designed to be self-contained. When contributing:

1. Keep it dependency-free (core).
2. Extensions (codecs) should use the Plugin system.
3. Maintain safety checks.

## Version History

-   **v2.0.0**: Major Release
    -   **Serialization**: Added DICOM Writer.
    -   **Anonymization**: Added `anonymize()` function.
    -   **CLI**: Added `rad-parser` CLI.
    -   **Architecture**: Refactored into modular `core`/`utils`/`plugins` structure.
    -   **Plugin Support**: Added hooks for external pixel data decoders.
-   **v1.1.1**: Compatibility Updates
-   **v1.0.0**: Initial Release
