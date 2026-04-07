import { describe, it, expect } from 'bun:test';
import { createFileOrImageMessagePart } from '../utils/fileHelpers';

function makeFile(name: string, type = 'application/octet-stream') {
    return new File(['test content'], name, { type });
}

describe('createFileOrImageMessagePart', () => {
    it('maps .txt to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('paper.txt'));
        expect(part.type).toBe('file');
        expect((part as any).mediaType).toBe('text/plain');
    });

    it('maps .md to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('readme.md'));
        expect(part.type).toBe('file');
        expect((part as any).mediaType).toBe('text/plain');
    });

    it('maps .csv to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('data.csv'));
        expect(part.type).toBe('file');
        expect((part as any).mediaType).toBe('text/plain');
    });

    it('maps .json to text/plain file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('data.json'));
        expect(part.type).toBe('file');
        expect((part as any).mediaType).toBe('text/plain');
    });

    it('maps .pdf to application/pdf file part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('paper.pdf'));
        expect(part.type).toBe('file');
        expect((part as any).mediaType).toBe('application/pdf');
    });

    it('maps .png to image/png image part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('figure.png'));
        expect(part.type).toBe('image');
        expect((part as any).mediaType).toBe('image/png');
    });

    it('maps .jpg to image/jpeg image part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('figure.jpg'));
        expect(part.type).toBe('image');
        expect((part as any).mediaType).toBe('image/jpeg');
    });

    it('maps .jpeg to image/jpeg image part', async () => {
        const part = await createFileOrImageMessagePart(makeFile('figure.jpeg'));
        expect(part.type).toBe('image');
        expect((part as any).mediaType).toBe('image/jpeg');
    });

    it('throws for unsupported extension', async () => {
        await expect(
            createFileOrImageMessagePart(makeFile('paper.docx'))
        ).rejects.toThrow('Unsupported file type');
    });

    it('is case-insensitive for extensions', async () => {
        const part = await createFileOrImageMessagePart(makeFile('paper.PDF'));
        expect(part.type).toBe('file');
        expect((part as any).mediaType).toBe('application/pdf');
    });
});
