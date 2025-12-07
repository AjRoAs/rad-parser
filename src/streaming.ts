/**
 * Streaming Parser: Handles incremental parsing of DICOM files
 *
 * Supports parsing DICOM files in chunks for memory-efficient processing
 * of very large files.
 */

import type { DicomElement } from './types';
import { SafeDataView } from './SafeDataView';
import { detectVR, detectVRForPrivateTag, requiresExplicitLength } from './vrDetection';
import { parseValueByVR } from './valueParsers';
import { parseSequence } from './sequenceParser';
import { extractPixelData } from './pixelData';
import { isPrivateTag } from './dictionary';

/**
 * Streaming parser state
 */
interface StreamingState {
  buffer: Uint8Array;
  offset: number;
  explicitVR: boolean;
  littleEndian: boolean;
  characterSet: string;
  transferSyntax?: string;
  isDicomPart10: boolean;
  initialized: boolean;
  pendingElement?: {
    group: number;
    element: number;
    vr?: string;
    length?: number;
    bytesRead: number;
    data: Uint8Array;
  };
}

/**
 * Parsed element callback
 */
export type ElementCallback = (element: {
  dict: Record<string, DicomElement>;
  normalizedElements: Record<string, DicomElement>;
}) => void;

/**
 * Streaming parser options
 */
export interface StreamingOptions {
  onElement?: ElementCallback;
  onError?: (error: Error) => void;
  maxBufferSize?: number; // Maximum buffer size before flushing (default: 10MB)
  maxIterations?: number; // Maximum elements to parse per chunk (default: 1000)
}

/**
 * Streaming DICOM parser
 */
export class StreamingParser {
  private state: StreamingState;
  private options: Required<Pick<StreamingOptions, 'maxBufferSize' | 'maxIterations'>> &
    Pick<StreamingOptions, 'onElement' | 'onError'>;

  constructor(options: StreamingOptions = {}) {
    this.options = {
      maxBufferSize: options.maxBufferSize ?? 10 * 1024 * 1024, // 10MB
      maxIterations: options.maxIterations ?? 1000,
      onElement: options.onElement,
      onError: options.onError,
    };

    this.state = {
      buffer: new Uint8Array(0),
      offset: 0,
      explicitVR: true,
      littleEndian: true,
      characterSet: 'ISO_IR 192',
      isDicomPart10: false,
      initialized: false,
    };
  }

  /**
   * Initialize parser with first chunk
   */
  initialize(chunk: Uint8Array): void {
    if (this.state.initialized) {
      throw new Error('Parser already initialized');
    }

    // Check for DICM magic string
    if (chunk.length >= 132) {
      const magic = chunk.slice(128, 132);
      const magicString = String.fromCharCode(...magic);
      if (magicString === 'DICM') {
        this.state.isDicomPart10 = true;
        this.state.offset = 132;
      }
    }

    // Read transfer syntax from meta information if Part 10
    if (this.state.isDicomPart10 && chunk.length >= 200) {
      try {
        // Ensure ArrayBuffer
        let buffer: ArrayBuffer;
        const sourceBuffer = chunk.buffer;
        if (sourceBuffer instanceof ArrayBuffer) {
          buffer = sourceBuffer.slice(chunk.byteOffset + this.state.offset);
        } else {
          // SharedArrayBuffer - copy to new ArrayBuffer
          const length = chunk.length - this.state.offset;
          buffer = new ArrayBuffer(length);
          const dest = new Uint8Array(buffer);
          const src = chunk.slice(this.state.offset);
          dest.set(src);
        }
        const metaView = new SafeDataView(buffer, 0);
        metaView.setEndianness(true);
        const metaInfo = this.readMetaInformation(metaView);
        this.state.transferSyntax = metaInfo.transferSyntax;
        this.state.offset += metaView.getPosition();

        // Determine endianness and VR type
        if (this.state.transferSyntax === '1.2.840.10008.1.2') {
          this.state.explicitVR = false;
          this.state.littleEndian = true;
        } else if (this.state.transferSyntax === '1.2.840.10008.1.2.2') {
          this.state.explicitVR = true;
          this.state.littleEndian = false;
        } else {
          this.state.explicitVR = true;
          this.state.littleEndian = true;
        }
      } catch {
        // Use defaults
      }
    }

    this.state.buffer = chunk;
    this.state.initialized = true;
  }

  /**
   * Process a chunk of data
   */
  processChunk(chunk: Uint8Array): void {
    if (!this.state.initialized) {
      this.initialize(chunk);
      return;
    }

    // Append chunk to buffer
    const newBuffer = new Uint8Array(this.state.buffer.length + chunk.length);
    newBuffer.set(this.state.buffer);
    newBuffer.set(chunk, this.state.buffer.length);
    this.state.buffer = newBuffer;

    // Process elements
    this.processElements();
  }

  /**
   * Finalize parsing (call when all data is received)
   */
  finalize(): void {
    if (!this.state.initialized) {
      return;
    }

    // Process any remaining elements
    this.processElements(true);

    // Clear buffer
    this.state.buffer = new Uint8Array(0);
  }

  /**
   * Process elements from buffer
   */
  private processElements(final: boolean = false): void {
    // Ensure we have an ArrayBuffer (not SharedArrayBuffer)
    let buffer: ArrayBuffer;
    const sourceBuffer = this.state.buffer.buffer;
    if (sourceBuffer instanceof ArrayBuffer) {
      buffer = sourceBuffer.slice(
        this.state.buffer.byteOffset + this.state.offset,
        this.state.buffer.byteOffset + this.state.buffer.length
      );
    } else {
      // SharedArrayBuffer - copy to new ArrayBuffer
      const length = this.state.buffer.length - this.state.offset;
      buffer = new ArrayBuffer(length);
      const dest = new Uint8Array(buffer);
      const src = this.state.buffer.slice(this.state.offset);
      dest.set(src);
    }

    const view = new SafeDataView(buffer, 0);
    view.setEndianness(this.state.littleEndian);

    let iterations = 0;

    while (
      view.getRemainingBytes() >= 8 &&
      iterations < this.options.maxIterations &&
      this.state.buffer.length < this.options.maxBufferSize
    ) {
      iterations++;

      try {
        const element = this.parseElement(view, final);
        if (!element) {
          break;
        }

        // Emit element
        if (this.options.onElement) {
          this.options.onElement(element);
        }

        // Update offset (relative to buffer start)
        this.state.offset += view.getPosition();
      } catch (error) {
        if (this.options.onError) {
          this.options.onError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
        break;
      }
    }
  }

  /**
   * Parse a single element
   */
  private parseElement(
    view: SafeDataView,
    final: boolean
  ): { dict: Record<string, DicomElement>; normalizedElements: Record<string, DicomElement> } | null {
    if (view.getRemainingBytes() < 8) {
      return null;
    }

    const startPos = view.getPosition();

    // Read tag
    const group = view.readUint16();
    const element = view.readUint16();

    // Check for delimiters
    if (group === 0xfffe && element === 0xe0dd) {
      view.readUint32();
      return null;
    }
    if (group === 0xfffe && element === 0xe00d) {
      view.readUint32();
      return null;
    }

    // Read VR
    let vr = 'UN';
    let length: number;

    if (this.state.explicitVR) {
      if (view.getRemainingBytes() < 2) {
        // Not enough data - wait for more
        view.setPosition(startPos);
        return null;
      }
      const vrBytes = view.readBytes(2);
      vr = String.fromCharCode(vrBytes[0], vrBytes[1]);

      if (requiresExplicitLength(vr)) {
        if (view.getRemainingBytes() < 6) {
          view.setPosition(startPos);
          return null;
        }
        view.readUint16();
        length = view.readUint32();
      } else {
        if (view.getRemainingBytes() < 2) {
          view.setPosition(startPos);
          return null;
        }
        length = view.readUint16();
      }
    } else {
      if (view.getRemainingBytes() < 4) {
        view.setPosition(startPos);
        return null;
      }
      length = view.readUint32();

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
      // For sequences, we need the full data - check if available
      if (length === 0xffffffff) {
        // Undefined length - parse until delimiter
        const sequence = parseSequence(
          view,
          this.state.explicitVR,
          this.state.littleEndian,
          this.state.characterSet,
          true
        );

        const elementData: DicomElement = {
          vr: 'SQ',
          VR: 'SQ',
          Value: sequence as unknown as Array<string | number> | Record<string, unknown>,
          value: sequence as unknown as Array<string | number> | Record<string, unknown>,
          length: undefined,
          Length: undefined,
          items: sequence as unknown[],
          Items: sequence as unknown[],
        };

        return {
          dict: { [tagHex]: elementData, [tagComma]: elementData },
          normalizedElements: { [tagHex]: elementData, [tagComma]: elementData },
        };
      } else if (view.getRemainingBytes() >= length) {
        const sequence = parseSequence(
          view,
          this.state.explicitVR,
          this.state.littleEndian,
          this.state.characterSet,
          false
        );

        const elementData: DicomElement = {
          vr: 'SQ',
          VR: 'SQ',
          Value: sequence as unknown as Array<string | number> | Record<string, unknown>,
          value: sequence as unknown as Array<string | number> | Record<string, unknown>,
          length: length,
          Length: length,
          items: sequence as unknown[],
          Items: sequence as unknown[],
        };

        return {
          dict: { [tagHex]: elementData, [tagComma]: elementData },
          normalizedElements: { [tagHex]: elementData, [tagComma]: elementData },
        };
      } else {
        // Not enough data - wait for more
        view.setPosition(startPos);
        return null;
      }
    }

    // Check if we have enough data for this element
    if (length > 0 && view.getRemainingBytes() < length) {
      if (!final) {
        // Not enough data - wait for more chunks
        view.setPosition(startPos);
        return null;
      }
      // Final chunk - read what we have
      length = view.getRemainingBytes();
    }

    // Handle pixel data
    const isPixelData = group === 0x7fe0 && element === 0x0010;
    let value: string | number | Array<string | number> | Record<string, unknown> | undefined = undefined;

    if (isPixelData) {
      const pixelDataResult = extractPixelData(view, length, this.state.transferSyntax);
      if (pixelDataResult) {
        value = {
          pixelData: Array.from(pixelDataResult.pixelData),
          isEncapsulated: pixelDataResult.isEncapsulated,
          fragments: pixelDataResult.fragments,
          transferSyntax: pixelDataResult.transferSyntax,
        };
      } else {
        // Skip pixel data if extraction fails
        if (length > 0 && view.getRemainingBytes() >= length) {
          view.readBytes(length);
        }
        return null;
      }
    } else if (length > 0 && view.getRemainingBytes() >= length) {
      const maxSize = 10000000; // 10MB limit
      if (length > maxSize) {
        view.readBytes(maxSize);
        return null;
      }

      try {
        value = this.parseElementValue(view, vr, length);
      } catch {
        view.readBytes(length);
        return null;
      }
    } else if (length === 0) {
      value = undefined;
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
   * Parse element value
   */
  private parseElementValue(
    view: SafeDataView,
    vr: string,
    length: number
  ): string | number | Array<string | number> | Record<string, unknown> {
    if (vr === 'OB' || vr === 'OW' || vr === 'OF' || vr === 'OD' || vr === 'OL' || vr === 'UN') {
      const bytes = view.readBytes(length);
      return Array.from(bytes);
    }

    if (vr === 'AT') {
      const count = length / 4;
      const tags: number[] = [];
      for (let i = 0; i < count; i++) {
        const g = view.readUint16();
        const e = view.readUint16();
        tags.push(g, e);
      }
      return tags;
    }

    const str = view.readString(length, this.state.characterSet);

    if (vr === 'IS' || vr === 'SL' || vr === 'SS' || vr === 'UL' || vr === 'US') {
      const parts = str.split('\\').filter(p => p.trim());
      if (parts.length === 1) {
        const num = parseFloat(parts[0]);
        return isNaN(num) ? str : Math.floor(num);
      }
      return parts.map(p => {
        const num = parseFloat(p.trim());
        return isNaN(num) ? p.trim() : num;
      });
    }

    if (vr === 'DS' || vr === 'FL' || vr === 'FD') {
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

    if (vr === 'PN' || vr === 'DA' || vr === 'TM' || vr === 'DT' || vr === 'AS') {
      const parsed = parseValueByVR(vr, str);
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

    const parts = str.split('\\');
    return parts.length === 1 ? parts[0] : parts;
  }

  /**
   * Read meta information from Part 10 file
   */
  private readMetaInformation(metaView: SafeDataView): { transferSyntax?: string } {
    const result: { transferSyntax?: string } = {};

    if (metaView.getRemainingBytes() < 8) {
      return result;
    }

    const metaGroup = metaView.readUint16();
    const metaElement = metaView.readUint16();

    if (metaGroup !== 0x0002 || metaElement !== 0x0000) {
      return result;
    }

    const vrBytes = metaView.readBytes(2);
    const vr = String.fromCharCode(vrBytes[0], vrBytes[1]);
    let length: number;
    if (requiresExplicitLength(vr)) {
      metaView.readUint16();
      length = metaView.readUint32();
    } else {
      length = metaView.readUint16();
    }
    metaView.readBytes(length);

    const maxMetaElements = 20;
    let metaIterations = 0;

    while (metaView.getRemainingBytes() >= 8 && metaIterations < maxMetaElements) {
      metaIterations++;
      const tsGroup = metaView.readUint16();
      const tsElement = metaView.readUint16();

      if (tsGroup === 0x0002 && tsElement === 0x0010) {
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
        break;
      } else if (tsGroup === 0x0002) {
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
        metaView.setPosition(metaView.getPosition() - 4);
        break;
      }
    }

    return result;
  }
}

/**
 * Parse DICOM file from ReadableStream
 */
export async function parseFromStream(
  stream: ReadableStream<Uint8Array>,
  options: StreamingOptions = {}
): Promise<void> {
  const parser = new StreamingParser(options);
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        parser.finalize();
        break;
      }
      parser.processChunk(value);
    }
  } catch (error) {
    if (options.onError) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse DICOM file from async iterator
 */
export async function parseFromAsyncIterator(
  iterator: AsyncIterable<Uint8Array>,
  options: StreamingOptions = {}
): Promise<void> {
  const parser = new StreamingParser(options);

  try {
    for await (const chunk of iterator) {
      parser.processChunk(chunk);
    }
    parser.finalize();
  } catch (error) {
    if (options.onError) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}

