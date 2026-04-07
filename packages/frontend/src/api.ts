import { treaty } from '@elysiajs/eden';
import type { App } from '../../backend/src/index';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

const api = treaty<App>(BASE_URL);

export default api;
