/**
 * RAD-Parser: In-House DICOM Parser Implementation
 *
 * A lightweight, performant, self-contained DICOM parser with no external dependencies.
 * Designed for safety and efficiency.
 *
 * Modular architecture:
 * - SafeDataView: Safe byte reading
 * - vrDetection: Implicit VR detection
 * - valueParsers: Specialized value parsing (PN, DA, TM, etc.)
 * - sequenceParser: Sequence parsing
 * - dictionary: Tag dictionary and lookup
 */

import { isPrivateTag } from './dictionary';
import { extractPixelData } from './pixelData';
import { SafeDataView } from './SafeDataView';
import { parseSequence } from './sequenceParser';
import { formatTagWithComma, normalizeTag } from './tagUtils';
import type { DicomDataSet, DicomElement } from './types';
import { parseValueByVR } from './valueParsers';
import { detectVR, detectVRForPrivateTag, requiresExplicitLength } from './vrDetection';

/**
 * Transfer syntax constants
 */
const TRANSFER_SYNTAX_IMPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2';
const TRANSFER_SYNTAX_EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1';
const TRANSFER_SYNTAX_EXPLICIT_VR_BIG_ENDIAN = '1.2.840.10008.1.2.2';

/**
 * Parse result with metadata
 */
export interface ParseResult {
  dataset: DicomDataSet;
  transferSyntax: string;
  characterSet: string;
}

/**
 * Extract transfer syntax from DICOM file without full parsing
 * Useful for quick format detection
 *
 * @param byteArray - The DICOM file as a Uint8Array
 * @returns Transfer syntax UID or undefined if not found
 */
export function extractTransferSyntax(byteArray: Uint8Array): string | undefined {
  try {
    let buffer: ArrayBuffer;
    if (byteArray.buffer instanceof ArrayBuffer) {
      buffer = byteArray.buffer.slice(
        byteArray.byteOffset,
        byteArray.byteOffset + byteArray.byteLength
      );
    } else {
      buffer = new ArrayBuffer(byteArray.byteLength);
      const newView = new Uint8Array(buffer);
      newView.set(byteArray);
    }

    const view = new SafeDataView(buffer);
    const detection = detectDicomFormat(view, buffer);
    return detection.transferSyntax;
  } catch {
    return undefined;
  }
}

/**
 * Check if byte array appears to be a valid DICOM file
 *
 * @param byteArray - The file data as a Uint8Array
 * @returns True if file appears to be valid DICOM
 */
export function canParse(byteArray: Uint8Array): boolean {
  try {
    if (byteArray.length < 8) {
      return false;
    }

    // Check for DICM magic string (Part 10 file)
    if (byteArray.length >= 132) {
      const magic = new Uint8Array(byteArray.buffer, byteArray.byteOffset + 128, 4);
      const magicString = String.fromCharCode(...magic);
      if (magicString === 'DICM') {
        return true;
      }
    }

    // Check if starts with valid DICOM tag (group should be reasonable)
    const view = new DataView(
      byteArray.buffer,
      byteArray.byteOffset,
      Math.min(byteArray.length, 8)
    );
    const group = view.getUint16(0, true); // Try little endian first
    if (group <= 0xffff && group !== 0x0000) {
      // Valid group number (not 0x0000 which is reserved)
      return true;
    }

    // Try big endian
    const groupBE = view.getUint16(0, false);
    if (groupBE <= 0xffff && groupBE !== 0x0000) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Parse DICOM file using rad-parser
 *
 * @param byteArray - The DICOM file as a Uint8Array
 * @returns A DicomDataSet compatible with the SmallVis parser system
 */
export function parseWithRadParser(byteArray: Uint8Array): DicomDataSet {
  try {
    const result = parseWithMetadata(byteArray);
    if (!result || !result.dataset) {
      throw new Error('rad-parser: parseWithMetadata returned invalid result');
    }
    return result.dataset;
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`rad-parser failed: ${error.message}`);
    }
    throw new Error('rad-parser failed: Unknown error');
  }
}

/**
 * Parse DICOM file with metadata
 *
 * @param byteArray - The DICOM file as a Uint8Array
 * @returns Parse result with dataset and metadata
 */
export function parseWithMetadata(byteArray: Uint8Array): ParseResult {
  // Ensure we have an ArrayBuffer (not SharedArrayBuffer)
  let buffer: ArrayBuffer;
  if (byteArray.buffer instanceof ArrayBuffer) {
    buffer = byteArray.buffer.slice(
      byteArray.byteOffset,
      byteArray.byteOffset + byteArray.byteLength
    );
  } else {
    // Copy to new ArrayBuffer if SharedArrayBuffer
    buffer = new ArrayBuffer(byteArray.byteLength);
    const newView = new Uint8Array(buffer);
    newView.set(byteArray);
  }

  if (buffer.byteLength < 8) {
    throw new Error('rad-parser: File too small to be a valid DICOM file');
  }

  const view = new SafeDataView(buffer);

  // Detect DICOM format and transfer syntax
  let detection: FormatDetection;
  try {
    detection = detectDicomFormat(view, buffer);
  } catch (error) {
    throw new Error(
      `rad-parser: Format detection failed - ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Set endianness and position for main parsing
  view.setEndianness(detection.littleEndian);
  view.setPosition(detection.offset);

  // Parse all data elements
  let characterSet = detection.characterSet;
  const parseContext = {
    explicitVR: detection.explicitVR,
    littleEndian: detection.littleEndian,
    characterSet: characterSet,
    transferSyntax: detection.transferSyntax,
  };

  let dict: Record<string, DicomElement>;
  let normalizedElements: Record<string, DicomElement>;
  let detectedCharacterSet: string | undefined;

  try {
    const parseResult = parseDataElements(view, parseContext);
    dict = parseResult.dict;
    normalizedElements = parseResult.normalizedElements;
    detectedCharacterSet = parseResult.detectedCharacterSet;
  } catch (error) {
    throw new Error(
      `rad-parser: Data element parsing failed - ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Update character set if found in dataset (tag 0008,0005)
  if (detectedCharacterSet) {
    characterSet = detectedCharacterSet;
    // Update context for any remaining parsing
    parseContext.characterSet = characterSet;
  }

  // Create accessor methods
  const dataset = createDataSet(dict, normalizedElements);

  if (
    !dataset ||
    typeof dataset !== 'object' ||
    !dataset.dict ||
    typeof dataset.string !== 'function'
  ) {
    throw new Error('rad-parser: Failed to create valid dataset structure');
  }

  return {
    dataset,
    transferSyntax: detection.transferSyntax,
    characterSet: characterSet,
  };
}

/**
 * DICOM format detection result
 */
interface FormatDetection {
  offset: number;
  isDicomPart10: boolean;
  transferSyntax: string;
  explicitVR: boolean;
  littleEndian: boolean;
  characterSet: string;
}

/**
 * Detect DICOM format and transfer syntax
 */
function detectDicomFormat(view: SafeDataView, buffer: ArrayBuffer): FormatDetection {
  let offset = 0;
  let isDicomPart10 = false;
  let transferSyntax = TRANSFER_SYNTAX_EXPLICIT_VR_LITTLE_ENDIAN;
  let explicitVR = true;
  let littleEndian = true;
  let characterSet = 'ISO_IR 192'; // Default: UTF-8

  // Check for DICM preamble (128 bytes) + "DICM" magic string
  if (buffer.byteLength >= 132) {
    const magic = new Uint8Array(buffer, 128, 4);
    const magicString = String.fromCharCode(...magic);
    if (magicString === 'DICM') {
      isDicomPart10 = true;
      offset = 132;
    }
  }

  // If not Part 10, check if it starts with a valid DICOM tag
  if (!isDicomPart10) {
    view.setPosition(0);
    try {
      const group = view.peekUint16();
      if (group <= 0xffff) {
        offset = 0;
      } else {
        throw new Error('Invalid DICOM file format');
      }
    } catch {
      throw new Error('Invalid DICOM file format');
    }
  }

  // Read transfer syntax from meta information (if Part 10 file)
  if (isDicomPart10) {
    const metaView = new SafeDataView(buffer, offset);
    metaView.setEndianness(true); // Meta information is always little endian

    try {
      const metaInfo = readMetaInformation(metaView);
      transferSyntax = metaInfo.transferSyntax || transferSyntax;
      offset = metaView.getPosition();

      // Determine endianness and VR type from transfer syntax
      if (transferSyntax === TRANSFER_SYNTAX_IMPLICIT_VR_LITTLE_ENDIAN) {
        explicitVR = false;
        littleEndian = true;
      } else if (transferSyntax === TRANSFER_SYNTAX_EXPLICIT_VR_BIG_ENDIAN) {
        explicitVR = true;
        littleEndian = false;
      } else {
        explicitVR = true;
        littleEndian = true;
      }
    } catch {
      // If reading fails, use defaults
      explicitVR = true;
      littleEndian = true;
    }
  } else {
    // Not Part 10 file, use defaults
    explicitVR = false; // Assume implicit VR for non-Part 10 files
    littleEndian = true;
  }

  return {
    offset,
    isDicomPart10,
    transferSyntax,
    explicitVR,
    littleEndian,
    characterSet,
  };
}

/**
 * Read meta information from Part 10 file
 */
function readMetaInformation(metaView: SafeDataView): {
  transferSyntax?: string;
  characterSet?: string;
} {
  const result: { transferSyntax?: string; characterSet?: string } = {};

  // Read meta information group length (0002,0000)
  const metaGroup = metaView.readUint16();
  const metaElement = metaView.readUint16();

  if (metaGroup !== 0x0002 || metaElement !== 0x0000) {
    return result;
  }

  // Read VR and length
  const vrBytes = metaView.readBytes(2);
  const vr = String.fromCharCode(vrBytes[0], vrBytes[1]);
  let length: number;
  if (requiresExplicitLength(vr)) {
    metaView.readUint16(); // Skip reserved bytes
    length = metaView.readUint32();
  } else {
    length = metaView.readUint16();
  }
  metaView.readBytes(length); // Skip group length value

  // Scan through meta information elements
  const maxMetaElements = 20;
  let metaIterations = 0;

  while (metaView.getRemainingBytes() >= 8 && metaIterations < maxMetaElements) {
    metaIterations++;
    const tsGroup = metaView.readUint16();
    const tsElement = metaView.readUint16();

    if (tsGroup === 0x0002 && tsElement === 0x0010) {
      // Transfer syntax UID
      const tsVrBytes = metaView.readBytes(2);
      const tsVr = String.fromCharCode(tsVrBytes[0], tsVrBytes[1]);
      let tsLength: number;
      if (requiresExplicitLength(tsVr)) {
        metaView.readUint16();
        tsLength = metaView.readUint32();
      } else {
        tsLength = metaView.readUint16();
      }
      result.transferSyntax = metaView.readString(tsLength).trim();
    } else if (tsGroup === 0x0002) {
      // Still in meta information group, skip this element
      const tsVrBytes = metaView.readBytes(2);
      const tsVr = String.fromCharCode(tsVrBytes[0], tsVrBytes[1]);
      let tsLength: number;
      if (requiresExplicitLength(tsVr)) {
        metaView.readUint16();
        tsLength = metaView.readUint32();
      } else {
        tsLength = metaView.readUint16();
      }
      metaView.readBytes(tsLength);
    } else {
      // Left meta information group
      metaView.setPosition(metaView.getPosition() - 4);
      break;
    }
  }

  return result;
}

/**
 * Parse context
 */
interface ParseContext {
  explicitVR: boolean;
  littleEndian: boolean;
  characterSet: string;
  transferSyntax?: string;
}

/**
 * Parse all data elements
 */
function parseDataElements(
  view: SafeDataView,
  context: ParseContext
): {
  dict: Record<string, DicomElement>;
  normalizedElements: Record<string, DicomElement>;
  detectedCharacterSet?: string;
} {
  const dict: Record<string, DicomElement> = {};
  const normalizedElements: Record<string, DicomElement> = {};
  let detectedCharacterSet: string | undefined;
  const maxIterations = 10000;
  let iterations = 0;

  while (view.getRemainingBytes() >= 8 && iterations < maxIterations) {
    iterations++;

    try {
      const element = parseElement(view, context);
      if (!element) {
        break;
      }

      // Check for character set tag (0008,0005) - Specific Character Set
      for (const tag in element.dict) {
        const cleanTag = tag.replace(/^x/i, '').replace(/,/g, '').toUpperCase();
        if (cleanTag === '00080005') {
          const charSetElem = element.dict[tag];
          const charSetValue = charSetElem?.Value || charSetElem?.value;
          if (typeof charSetValue === 'string') {
            // Character set can be multiple values separated by backslash
            // First value is the primary character set
            detectedCharacterSet = charSetValue.split('\\')[0].trim();
            // Update context for future parsing
            context.characterSet = detectedCharacterSet;
          } else if (
            Array.isArray(charSetValue) &&
            charSetValue.length > 0 &&
            typeof charSetValue[0] === 'string'
          ) {
            detectedCharacterSet = charSetValue[0].trim();
            context.characterSet = detectedCharacterSet;
          }
        }
      }

      // Store in multiple formats for compatibility
      for (const tag in element.dict) {
        dict[tag] = element.dict[tag];
        normalizedElements[normalizeTag(tag)] = element.dict[tag];
        normalizedElements[formatTagWithComma(tag)] = element.dict[tag];
      }
    } catch {
      // Error reading element - stop parsing
      break;
    }
  }

  return { dict, normalizedElements, detectedCharacterSet };
}

/**
 * Parse a single element
 */
function parseElement(
  view: SafeDataView,
  context: ParseContext
): { dict: Record<string, DicomElement>; normalizedElements: Record<string, DicomElement> } | null {
  if (view.getRemainingBytes() < 8) {
    return null;
  }

  // Read tag
  const group = view.readUint16();
  const element = view.readUint16();

  // Check for sequence delimiter or end of data
  if (group === 0xfffe && element === 0xe0dd) {
    // Sequence delimiter
    view.readUint32(); // Read length (should be 0)
    return null;
  }
  if (group === 0xfffe && element === 0xe00d) {
    // Item delimiter
    view.readUint32(); // Read length (should be 0)
    return null;
  }

  // Read VR
  let vr = 'UN';
  let length: number;

  if (context.explicitVR) {
    const vrBytes = view.readBytes(2);
    vr = String.fromCharCode(vrBytes[0], vrBytes[1]);

    if (requiresExplicitLength(vr)) {
      view.readUint16(); // Skip reserved bytes
      length = view.readUint32();
    } else {
      length = view.readUint16();
    }
  } else {
    // Implicit VR: use detection
    length = view.readUint32();

    // Check if private tag and use enhanced detection
    const tagHex = `x${group.toString(16).padStart(4, '0')}${element.toString(16).padStart(4, '0')}`;
    if (isPrivateTag(tagHex)) {
      vr = detectVRForPrivateTag(group, element, length);
    } else {
      vr = detectVR(group, element);
    }
  }

  // Format tag
  const tagHex = `x${group.toString(16).padStart(4, '0')}${element.toString(16).padStart(4, '0')}`;
  const tagComma = `${group.toString(16).padStart(4, '0')},${element.toString(16).padStart(4, '0')}`;

  // Handle sequences
  if (vr === 'SQ' || length === 0xffffffff) {
    const sequence = parseSequence(
      view,
      context.explicitVR,
      context.littleEndian,
      context.characterSet,
      length === 0xffffffff
    );

    const elementData: DicomElement = {
      vr: 'SQ',
      VR: 'SQ',
      Value: sequence as unknown as Array<string | number> | Record<string, unknown>,
      value: sequence as unknown as Array<string | number> | Record<string, unknown>,
      length: length === 0xffffffff ? undefined : length,
      Length: length === 0xffffffff ? undefined : length,
      items: sequence as unknown[],
      Items: sequence as unknown[],
    };

    return {
      dict: { [tagHex]: elementData, [tagComma]: elementData },
      normalizedElements: { [tagHex]: elementData, [tagComma]: elementData },
    };
  }

  // Handle pixel data (7FE0,0010) - extract even if large
  const isPixelData = group === 0x7fe0 && element === 0x0010;

  // Read value
  let value: string | number | Array<string | number> | Record<string, unknown> | undefined =
    undefined;

  if (isPixelData) {
    // Extract pixel data (can be large) - use current view position
    const pixelDataResult = extractPixelData(view, length, context.transferSyntax);

    if (pixelDataResult) {
      // Store pixel data with metadata
      value = {
        pixelData: Array.from(pixelDataResult.pixelData),
        isEncapsulated: pixelDataResult.isEncapsulated,
        fragments: pixelDataResult.fragments,
        transferSyntax: pixelDataResult.transferSyntax,
      };

      // View position is already advanced by extractPixelData
    } else {
      // Failed to extract - skip
      if (length === 0xffffffff) {
        // Skip encapsulated data - try to find delimiter
        let skipped = 0;
        while (view.getRemainingBytes() >= 8 && skipped < 1000000) {
          const g = view.readUint16();
          const e = view.readUint16();
          if (g === 0xfffe && e === 0xe0dd) {
            view.readUint32(); // Read delimiter length
            break;
          }
          view.setPosition(view.getPosition() - 4); // Back up
          view.readBytes(Math.min(8, view.getRemainingBytes()));
          skipped += 8;
        }
      } else {
        view.readBytes(length);
      }
      return null;
    }
  } else if (length > 0 && view.getRemainingBytes() >= length) {
    // Regular element - apply size limit for non-pixel data
    const maxSize = 10000000; // 10MB limit for regular elements
    if (length > maxSize) {
      // Safety check: skip very large values (except pixel data)
      view.readBytes(maxSize);
      return null;
    }

    try {
      value = parseElementValue(view, vr, length, context.characterSet);
    } catch {
      view.readBytes(length);
      return null;
    }
  } else if (length === 0) {
    value = undefined;
  } else {
    // Not enough bytes - end of file
    return null;
  }

  // Create element
  const elementData: DicomElement = {
    vr,
    VR: vr,
    Value: value,
    value: value,
    length: length,
    Length: length,
  };

  return {
    dict: { [tagHex]: elementData, [tagComma]: elementData },
    normalizedElements: { [tagHex]: elementData, [tagComma]: elementData },
  };
}

/**
 * Parse element value based on VR
 */
function parseElementValue(
  view: SafeDataView,
  vr: string,
  length: number,
  characterSet: string
): string | number | Array<string | number> | Record<string, unknown> {
  if (vr === 'OB' || vr === 'OW' || vr === 'OF' || vr === 'OD' || vr === 'OL' || vr === 'UN') {
    // Binary data
    const bytes = view.readBytes(length);
    return Array.from(bytes);
  }

  if (vr === 'AT') {
    // Attribute tag
    const count = length / 4;
    const tags: number[] = [];
    for (let i = 0; i < count; i++) {
      const g = view.readUint16();
      const e = view.readUint16();
      tags.push(g, e);
    }
    return tags;
  }

  // String-based VR
  const str = view.readString(length, characterSet);

  // Parse based on VR type
  if (vr === 'IS' || vr === 'SL' || vr === 'SS' || vr === 'UL' || vr === 'US') {
    // Numeric types
    const parts = str.split('\\').filter(p => p.trim());
    if (parts.length === 1) {
      const num = parseFloat(parts[0]);
      return isNaN(num) ? str : vr === 'US' || vr === 'UL' ? Math.floor(num) : Math.floor(num);
    }
    return parts.map(p => {
      const num = parseFloat(p.trim());
      return isNaN(num) ? p.trim() : num;
    });
  }

  if (vr === 'DS' || vr === 'FL' || vr === 'FD') {
    // Floating point types
    const parts = str.split('\\').filter(p => p.trim());
    if (parts.length === 1) {
      const num = parseFloat(parts[0]);
      return isNaN(num) ? str : num;
    }
    return parts.map(p => {
      const num = parseFloat(p.trim());
      return isNaN(num) ? p.trim() : num;
    });
  }

  // Use specialized parsers for special VR types
  if (vr === 'PN' || vr === 'DA' || vr === 'TM' || vr === 'DT' || vr === 'AS') {
    const parsed = parseValueByVR(vr, str);
    // Ensure return type matches
    if (
      typeof parsed === 'string' ||
      typeof parsed === 'number' ||
      Array.isArray(parsed) ||
      (typeof parsed === 'object' && parsed !== null)
    ) {
      return parsed as string | number | Array<string | number> | Record<string, unknown>;
    }
    return str;
  }

  // String types
  const parts = str.split('\\');
  return parts.length === 1 ? parts[0] : parts;
}

/**
 * Create dataset with accessor methods
 */
function createDataSet(
  dict: Record<string, DicomElement>,
  normalizedElements: Record<string, DicomElement>
): DicomDataSet {
  const getElement = (tag: string): DicomElement | undefined => {
    const normalized = normalizeTag(tag);
    const comma = formatTagWithComma(tag);
    return (
      dict[tag] ||
      dict[normalized] ||
      dict[comma] ||
      normalizedElements[normalized] ||
      normalizedElements[tag] ||
      normalizedElements[comma]
    );
  };

  return {
    string: (tag: string) => {
      const elem = getElement(tag);
      if (!elem) return undefined;
      const val = elem.Value ?? elem.value;
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        return val[0];
      }
      if (typeof val === 'object' && val !== null && 'Alphanumeric' in val) {
        return (val as { Alphanumeric?: string }).Alphanumeric;
      }
      if (typeof val === 'number') return String(val);
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
        return String(val[0]);
      }
      return undefined;
    },
    uint16: (tag: string) => {
      const elem = getElement(tag);
      if (!elem) return undefined;
      const val = elem.Value ?? elem.value;
      if (typeof val === 'number') return Math.floor(val) & 0xffff;
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
        return Math.floor(val[0]) & 0xffff;
      }
      if (typeof val === 'string') {
        const num = parseInt(val, 10);
        return isNaN(num) ? undefined : num & 0xffff;
      }
      return undefined;
    },
    int16: (tag: string) => {
      const elem = getElement(tag);
      if (!elem) return undefined;
      const val = elem.Value ?? elem.value;
      if (typeof val === 'number') {
        const num = Math.floor(val);
        return num >= -32768 && num <= 32767 ? num : undefined;
      }
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
        const num = Math.floor(val[0]);
        return num >= -32768 && num <= 32767 ? num : undefined;
      }
      if (typeof val === 'string') {
        const num = parseInt(val, 10);
        return isNaN(num) || num < -32768 || num > 32767 ? undefined : num;
      }
      return undefined;
    },
    floatString: (tag: string) => {
      const elem = getElement(tag);
      if (!elem) return undefined;
      const val = elem.Value ?? elem.value;
      if (typeof val === 'number') return val;
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
        return val[0];
      }
      if (typeof val === 'string') {
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    },
    intString: (tag: string) => {
      const elem = getElement(tag);
      if (!elem) return undefined;
      const val = elem.Value ?? elem.value;
      if (typeof val === 'number') return Math.floor(val);
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
        return Math.floor(val[0]);
      }
      if (typeof val === 'string') {
        const num = parseInt(val, 10);
        return isNaN(num) ? undefined : Math.floor(num);
      }
      return undefined;
    },
    dict,
    elements: normalizedElements,
  };
}
