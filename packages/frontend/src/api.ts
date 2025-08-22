import { treaty } from '@elysiajs/eden';
import type { App } from '../../backend/src/index'; // Import the backend type

const api = treaty<App>('http://localhost:3000');

export default api;
