import { existsSync } from 'fs';
import { join } from 'path';
import { env } from 'process';

const envPath = join(process.cwd(), '.env');

const envVars = ['TG_BOT_TOKEN', 'TG_GROUP_ID', 'TG_ADMIN_ID', 'DATABASE_URL'];

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const missingVars = envVars.filter((key) => !env[key]);

if (missingVars.length) {
  missingVars.forEach((key) => {
    console.error(`   👉 ${key}`);
  });
  console.error('\n Пожалуйста, добавьте их в файл .env и попробуйте снова.\n');
  process.exit(1);
}
