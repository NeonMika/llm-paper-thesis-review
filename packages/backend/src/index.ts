/// <reference types="bun-types" />
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';

import { sectionRoutes } from './routes/section.ts';
import { reviewRoutes } from './routes/review.ts';
import { followUpRoutes } from './routes/followUp.ts';
import { promptPreviewRoutes } from './routes/promptPreview.ts';

export type { PaperKind, PublicationKind, Section, StudentWorkKind } from './schemas.ts';
export type { ReviewType } from './reviewTypePrompts.ts';

const app = new Elysia({
    serve: {
        idleTimeout: 255,
    },
})
    .use(cors())
    .use(swagger())
    .use(sectionRoutes)
    .use(reviewRoutes)
    .use(followUpRoutes)
    .use(promptPreviewRoutes)
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
