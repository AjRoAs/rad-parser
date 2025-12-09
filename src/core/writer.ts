/**
 * DICOM Writer
 *
 * simple zero-dependency DICOM serializer.
 * Supports Explicit VR Little Endian (Part 10).
 */

import { DicomDataSet, DicomElement } from './types';

export interface WriteOptions {
  /**
   * Transfer Syntax to write.
   * Currently only supports Explicit VR Little Endian (1.2.840.10008.1.2.1).
   */
  transferSyntax?: string;
  /**
   * Character Set (default: ISO_IR 192 / UTF-8)
   */
  characterSet?: string;
}

const PREAMBLE_LENGTH = 128;
const TRANSFER_SYNTAX_EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1';
const IMPLEMENTATION_CLASS_UID = '1.2.826.0.1.3680043.9.7433.1.1'; // Example generic UID or project specific
const IMPLEMENTATION_VERSION_NAME = 'RADPARSER_2_0';

/**
 * VRs that use 32-bit length (Explicit VR)
 */
const LONG_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN']);

/**
 * VRs that use space padding (0x20)
 */
const SPACE_PADDED_VRS = new Set(['AE', 'AS', 'CS', 'DA', 'DS', 'DT', 'IS', 'LO', 'LT', 'PN', 'SH', 'ST', 'TM', 'UC', 'UR', 'UT']);

// TextEncoder
const encoder = new TextEncoder();

/**
 * Serialize a DicomDataSet to a Uint8Array (DICOM Part 10 file).
 *
 * @param dataset - The dataset to serialize
 * @param options - serialization options
 * @returns Uint8Array containing the DICOM file
 */
export function write(dataset: DicomDataSet, options: WriteOptions = {}): Uint8Array {
  const chunks: Uint8Array[] = [];

  // 1. Preamble (128 bytes 0x00)
  chunks.push(new Uint8Array(PREAMBLE_LENGTH));

  // 2. DICM Prefix
  chunks.push(encoder.encode('DICM'));

  // 3. Prepare Data Elements (exclude Group 0002)
  // We exclude group 2 because we build it manually in step 4
  const dataElements: Record<string, DicomElement> = {};
  Object.keys(dataset.dict).forEach(tag => {
     if (!tag.startsWith('x0002')) {
         dataElements[tag] = dataset.dict[tag];
     }
  });
  
  const dataChunks: Uint8Array[] = [];
  const sortedTags = Object.keys(dataElements).sort();
  for (const tag of sortedTags) {
     const element = dataElements[tag];
     const chunk = serializeElement(tag, element);
     if (chunk) {
        dataChunks.push(chunk);
     }
  }
  
  // 4. File Meta Information (Group 0002)
  const metaElements: Record<string, DicomElement> = {};
  
  // Use existing 0002 elements if present, else create defaults
  // Copy existing group 0002 elements
  Object.keys(dataset.dict).forEach(tag => {
     if (tag.startsWith('x0002')) {
         metaElements[tag] = dataset.dict[tag];
     }
  });
  
  // Enforce mandatory Meta Elements
  // 0002,0001 File Meta Information Version
  if (!metaElements['x00020001']) {
      metaElements['x00020001'] = { vr: 'OB', Value: new Uint8Array([0x00, 0x01]) };
  }
  // 0002,0002 Media Storage SOP Class UID (use 0008,0016)
  if (!metaElements['x00020002']) {
     const sopClass = dataset.dict['x00080016']?.Value;
     if (sopClass) metaElements['x00020002'] = { vr: 'UI', Value: sopClass };
  }
  // 0002,0003 Media Storage SOP Instance UID (use 0008,0018)
  if (!metaElements['x00020003']) {
     const sopInstance = dataset.dict['x00080018']?.Value;
     if (sopInstance) metaElements['x00020003'] = { vr: 'UI', Value: sopInstance };
  }
  // 0002,0010 Transfer Syntax UID
  metaElements['x00020010'] = { vr: 'UI', Value: options.transferSyntax || TRANSFER_SYNTAX_EXPLICIT_VR_LITTLE_ENDIAN };
  
  // 0002,0012 Implementation Class UID
  if (!metaElements['x00020012']) {
      metaElements['x00020012'] = { vr: 'UI', Value: IMPLEMENTATION_CLASS_UID };
  }
  // 0002,0013 Implementation Version Name
    if (!metaElements['x00020013']) {
      metaElements['x00020013'] = { vr: 'SH', Value: IMPLEMENTATION_VERSION_NAME };
  }

  // Sort Meta Tags
  const sortedMetaTags = Object.keys(metaElements).sort();
  const metaChunks: Uint8Array[] = [];
  
  for (const tag of sortedMetaTags) {
     const element = metaElements[tag];
     // Meta header is ALWAYS Explicit VR Little Endian
     // So we can use the same serializeElement
     const chunk = serializeElement(tag, element);
     if (chunk) metaChunks.push(chunk);
  }
  
  // Calculate File Meta Information Group Length (0002,0000)
  const metaLength = metaChunks.reduce((acc, c) => acc + c.length, 0);
  const groupLengthElement: DicomElement = { vr: 'UL', Value: metaLength };
  const groupLengthChunk = serializeElement('x00020000', groupLengthElement);
  
  // Add 0002,0000 at the start of meta info
  if (groupLengthChunk) {
    chunks.push(groupLengthChunk);
  }
  chunks.push(...metaChunks); // Then rest of meta
  chunks.push(...dataChunks); // Then body

  return concatChunks(chunks);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function serializeDataset(dict: Record<string, DicomElement>): Uint8Array {
  const sortedTags = Object.keys(dict)
    .filter(tag => tag.startsWith('x'))
    .sort();

  const chunks: Uint8Array[] = [];
  for (const tag of sortedTags) {
     const element = dict[tag];
     const chunk = serializeElement(tag, element);
     if (chunk) {
        chunks.push(chunk);
     }
  }
  return concatChunks(chunks);
}

function serializeElement(tagHex: string, element: DicomElement): Uint8Array | null {
   // Parse tag xGGGGEEEE
   if (tagHex.length !== 9 || !tagHex.startsWith('x')) return null;
   const group = parseInt(tagHex.substring(1, 5), 16);
   const elem = parseInt(tagHex.substring(5, 9), 16);
   
   const vr = (element.vr || 'UN').toUpperCase();
   let valueBytes: Uint8Array | null = null;
   const isLongVR = LONG_VRS.has(vr);

   // Handle Sequences (SQ)
   if (vr === 'SQ' || (element.items && Array.isArray(element.items))) {
       // We'll use Undefined Length for SQ + Undefined Length for Items (or Explicit for Items if possible)
       // Standard practice: SQ (Undefined Length) -> Item (Undefined Length) -> Elements -> Item Delim -> Item ... -> Seq Delim
       // Simpler for Writer: SQ (Undefined Length) -> Item (Explicit Length) -> Elements -> (No Item Delim needed if explicit) -> Seq Delim
       
       // Let's use SQ with Undefined Length (0xFFFFFFFF)
       // And Items with Explicit Length if we can calculate it easily, otherwise Undefined.
       // Recursive calling requires explicit handling.
       
       const itemChunks: Uint8Array[] = [];
       const items = (element.items || []) as any[];
       for (const item of items) {
           // Item Tag (FFFE, E000)
           // Each item has 'elements' (or 'dict' depending on structure)
           // Parser produces SequenceItem { elements: ... }
           const itemElementsIn = item.elements || {}; 
           const itemBody = serializeDataset(itemElementsIn); // Recursive
           
           // Item Header: FFFE, E000, Length (4 bytes)
           const itemHeader = new Uint8Array(8);
           const itemView = new DataView(itemHeader.buffer);
           itemView.setUint16(0, 0xFFFE, true);
           itemView.setUint16(2, 0xE000, true);
           itemView.setUint32(4, itemBody.length, true); // Explicit Length for Item
           
           itemChunks.push(itemHeader);
           itemChunks.push(itemBody);
       }
       
       // Sequence Delimitation Item (FFFE, E0DD) Length 0
       const seqDelim = new Uint8Array(8);
       const seqDelimView = new DataView(seqDelim.buffer);
       seqDelimView.setUint16(0, 0xFFFE, true);
       seqDelimView.setUint16(2, 0xE0DD, true);
       seqDelimView.setUint32(4, 0, true);
       
       itemChunks.push(seqDelim);
       
       // Concatenate all items content (without SQ header yet)
       valueBytes = concatChunks(itemChunks);
   } else if (element.Value instanceof Uint8Array) {
       valueBytes = element.Value;
   } else if (element.Value instanceof ArrayBuffer) {
        valueBytes = new Uint8Array(element.Value);
   } else if (Array.isArray(element.Value) && element.Value.length > 0 && element.Value[0] instanceof Uint8Array) {
       const totalLen = (element.Value as Uint8Array[]).reduce((a, b) => a + b.length, 0);
       valueBytes = new Uint8Array(totalLen);
       let off = 0;
       for (const v of (element.Value as Uint8Array[])) {
           valueBytes.set(v, off);
           off += v.length;
       }
   } else {
       // String or Number
       let valStr: string = '';
       if (element.Value === undefined || element.Value === null) {
           valStr = '';
       } else if (Array.isArray(element.Value)) {
           valStr = element.Value.join('\\');
       } else {
           // Check for parsed objects (PN, Date, AS)
           const val = element.Value;
           if (typeof val === 'object' && val !== null) {
               if ('Alphanumeric' in val) {
                   // Person Name
                   valStr = (val as any).Alphanumeric;
               } else if (val instanceof Date) {
                   // Date/Time - this is tricky without original format.
                   // We should ideally keep original string in parser, but we don't.
                   // Construct ISO string or similar?
                   // DICOM DA: YYYYMMDD
                   // DT: YYYYMMDDHHMMSS...
                   // TM: HHMMSS...
                   // Logic depends on VR.
                   if (vr === 'DA') {
                        valStr = val.toISOString().slice(0, 10).replace(/-/g, '');
                   } else if (vr === 'TM') {
                        valStr = val.toISOString().slice(11, 19).replace(/:/g, '');
                   } else if (vr === 'DT') {
                        // YYYYMMDDHHMMSS
                        valStr = val.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '');
                   } else {
                        valStr = val.toString();
                   }
               } else if ('value' in val && 'unit' in val) {
                   // Age String
                   valStr = `${(val as any).value}${(val as any).unit}`;
               } else {
                   valStr = String(val);
               }
           } else {
               valStr = String(val);
           }
       }
       
       valueBytes = encoder.encode(valStr);
       
       // Padding
       if (valueBytes.length % 2 !== 0) {
           const padChar = SPACE_PADDED_VRS.has(vr) ? 0x20 : 0x00;
           const padded = new Uint8Array(valueBytes.length + 1);
           padded.set(valueBytes);
           padded[valueBytes.length] = padChar;
           valueBytes = padded;
       }
   }
   
   if (!valueBytes) {
      // Empty value
      valueBytes = new Uint8Array(0);
   }

   // Write Element Header
   const headerLen = isLongVR ? 12 : 8;
   const buffer = new Uint8Array(headerLen + valueBytes.length);
   const view = new DataView(buffer.buffer);
   
   // Tag
   view.setUint16(0, group, true);
   view.setUint16(2, elem, true);
   
   // VR
   buffer[4] = vr.charCodeAt(0);
   buffer[5] = vr.charCodeAt(1);
   
   // Length
   if (isLongVR) {
       view.setUint16(6, 0, true); // Reserved
       
       // SQ Header Logic
       if (vr === 'SQ') {
           view.setUint32(8, 0xFFFFFFFF, true); // Undefined Length for SQ
       } else {
           view.setUint32(8, valueBytes.length, true);
       }
       buffer.set(valueBytes, 12);
   } else {
       view.setUint16(6, valueBytes.length, true);
       buffer.set(valueBytes, 8);
   }
   
   return buffer;
}
