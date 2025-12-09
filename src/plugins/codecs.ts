/**
 * Codec Plugin Interface
 *
 * Allows registering custom decoders for compressed Transfer Syntaxes.
 */

import type { DicomElement } from '../core/types';

/**
 * Interface for a custom pixel data decoder.
 * Users can provide a plugin that matches a transfer syntax or general decoding logic.
 */
export interface PixelDataDecoder {
  /**
   * Decode pixel data element.
   * @param element - The DicomElement (likely Pixel Data 7FE0,0010)
   * @param transferSyntax - The transfer syntax of the dataset
   * @returns Decoded value (Uint8Array, Int16Array, etc.) or undefined if not handled
   */
  decode(element: DicomElement, transferSyntax: string): unknown;
}
