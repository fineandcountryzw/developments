
const fs = require('fs');
const path = require('path');

// Target file for environment variables
const targetPath = path.join(__dirname, 'environment.prod.ts');

// Environment configuration template
const envConfigFile = `
export const environment = {
  production: true,
  databaseUrl: '${process.env.DATABASE_URL || ''}'
};
`;

console.log('Fine & Country ERP: Generating environment.prod.ts...');

try {
  fs.writeFileSync(targetPath, envConfigFile);
  console.log(`Environment file successfully generated at ${targetPath}`);
} catch (err) {
  console.error('Failed to write environment file:', err);
  process.exit(1);
}
