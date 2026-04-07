import type { FilePart, ImagePart } from 'ai';

export async function createFileOrImageMessagePart(file: File): Promise<ImagePart | FilePart> {
    let mediaType;
    let type: 'file' | 'image';
    const extension = (file.name.split('.').pop() ?? 'txt').toLowerCase();

    switch (extension) {
        case 'txt':
        case 'tex':
        case 'md':
        case 'csv':
        case 'json':
            type = 'file';
            mediaType = 'text/plain';
            break;
        case 'pdf':
            type = 'file';
            mediaType = 'application/pdf';
            break;
        case 'png':
            type = 'image';
            mediaType = 'image/png';
            break;
        case 'jpg':
        case 'jpeg':
            type = 'image';
            mediaType = 'image/jpeg';
            break;
        default:
            throw new Error(`Unsupported file type: ${file.name}`);
    }

    if (type === 'image') {
        return {
            type: 'image',
            mediaType: mediaType,
            image: await file.arrayBuffer(),
        };
    } else {
        return {
            type: 'file',
            mediaType: mediaType,
            data: await file.arrayBuffer(),
        };
    }
}
