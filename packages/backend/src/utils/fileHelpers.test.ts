import { describe, it, expect } from 'bun:test';
import type { FilePart, ImagePart } from 'ai';
import { createFileOrImageMessagePart } from '../utils/fileHelpers';

function makeFile(name: string, type = 'application/octet-stream') {
    return new File(['test content'], name, { type });
}

describe('createFileOrImageMessagePart', () => {
    it('maps .txt to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('paper.txt')) as FilePart;
        expect(part.type).toBe('file');
        expect(part.mediaType).toBe('text/plain');
    });

    it('maps .md to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('readme.md')) as FilePart;
        expect(part.type).toBe('file');
        expect(part.mediaType).toBe('text/plain');
    });

    it('maps .csv to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('data.csv')) as FilePart;
        expect(part.type).toBe('file');
        expect(part.mediaType).toBe('text/plain');
    });

    it('maps .json to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('data.json')) as FilePart;
        expect(part.type).toBe('file');
        expect(part.mediaType).toBe('text/plain');
    });

    it('maps .tex to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('paper.tex')) as FilePart;
        expect(part.type).toBe('file');
        expect(part.mediaType).toBe('text/plain');
    });

    it('maps .pdf to application/pdf file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('paper.pdf')) as FilePart;
        expect(part.type).toBe('file');
        expect(part.mediaType).toBe('application/pdf');
    });

    it('maps .png to image/png image part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('figure.png')) as ImagePart;
        expect(part.type).toBe('image');
        expect(part.mediaType).toBe('image/png');
    });

    it('maps .jpg to image/jpeg image part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('figure.jpg')) as ImagePart;
        expect(part.type).toBe('image');
        expect(part.mediaType).toBe('image/jpeg');
    });

    it('maps .jpeg to image/jpeg image part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('figure.jpeg')) as ImagePart;
        expect(part.type).toBe('image');
        expect(part.mediaType).toBe('image/jpeg');
    });

    it('throws for unsupported extension', async () => {
        await expect(
            createFileOrImageMessagePart(makeFile('paper.docx'))
        ).rejects.toThrow('Unsupported file type');
    });

    it('is case-insensitive for extensions', async () => {
        const part = await createFileOrImageMessagePart(makeFile('paper.PDF')) as FilePart;
        expect(part.type).toBe('file');
        expect(part.mediaType).toBe('application/pdf');
    });
});
