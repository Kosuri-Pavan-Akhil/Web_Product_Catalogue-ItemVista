import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

const host = process.env.API_HOST || '127.0.0.1';
createApi().listen(3000, host, () => {
  console.log('API listening on ' + host + ':3000');
});
