import { existsSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
