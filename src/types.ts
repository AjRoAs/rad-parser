/**
 * Type definitions for RAD-Parser
 *
 * These types define the interface for DICOM data structures
 * compatible with the SmallVis parser system.
 */

/**
 * Sequence Item structure
 */
export interface SequenceItem {
  elements: Record<string, DicomElement>;
  normalizedElements: Record<string, DicomElement>;
}

/**
 * DICOM Element structure
 * Compatible with SmallVis parser types (matches src/core/parsers/types.ts)
 */
export interface DicomElement {
  vr?: string;
  VR?: string;
  Value?: string | number | Array<string | number> | Record<string, unknown>;
  value?: string | number | Array<string | number> | Record<string, unknown>;
  length?: number;
  Length?: number;
  items?: unknown[];
  Items?: unknown[];
  [key: string]: unknown;
}

/**
 * DICOM Data Set structure
 * Provides access methods compatible with dcmjs format
 */
export interface DicomDataSet {
  // Access methods for compatibility
  string: (tag: string) => string | undefined;
  uint16: (tag: string) => number | undefined;
  int16: (tag: string) => number | undefined;
  floatString: (tag: string) => number | undefined;
  intString?: (tag: string) => number | undefined;
  // Native dict structure
  dict: Record<string, DicomElement>;
  // Elements accessor for backward compatibility (normalized tags)
  elements: Record<string, DicomElement>;
}

