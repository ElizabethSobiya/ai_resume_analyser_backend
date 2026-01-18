import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export class ParserService {
  /**
   * Parse a file buffer and extract text content
   */
  async parseBuffer(buffer: Buffer, originalName: string): Promise<string> {
    const extension = path.extname(originalName).toLowerCase();

    switch (extension) {
      case '.pdf':
        return this.parsePDFBuffer(buffer);
      case '.docx':
        return this.parseDOCXBuffer(buffer);
      case '.doc':
        throw new Error('Legacy .doc format is not supported. Please use .docx or .pdf');
      case '.txt':
        return this.parseTXTBuffer(buffer);
      default:
        throw new Error(`Unsupported file format: ${extension}. Supported formats: PDF, DOCX, TXT`);
    }
  }

  /**
   * Parse PDF buffer and extract text
   */
  private async parsePDFBuffer(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('Could not extract text from PDF. The file may be image-based or corrupted.');
      }

      return this.cleanText(data.text);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse PDF: ${error.message}`);
      }
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Parse DOCX buffer and extract text
   */
  private async parseDOCXBuffer(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      if (!result.value || result.value.trim().length === 0) {
        throw new Error('Could not extract text from DOCX. The file may be empty or corrupted.');
      }

      if (result.messages.length > 0) {
        console.warn('DOCX parsing warnings:', result.messages);
      }

      return this.cleanText(result.value);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse DOCX: ${error.message}`);
      }
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Parse plain text buffer
   */
  private async parseTXTBuffer(buffer: Buffer): Promise<string> {
    try {
      const content = buffer.toString('utf-8');
      return this.cleanText(content);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read text file: ${error.message}`);
      }
      throw new Error('Failed to read text file');
    }
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string): string {
    return text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace while preserving paragraph breaks
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace from each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Remove any null characters or other control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Final trim
      .trim();
  }

  /**
   * Validate file size and type
   */
  validateFile(file: Express.Multer.File): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, DOCX, TXT`);
    }
  }
}

export const parserService = new ParserService();
