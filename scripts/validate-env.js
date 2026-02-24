#!/usr/bin/env node

/**
 * Environment Variable Validation Script - Phase 3
 * Ensures all required environment variables are set and properly formatted
 * Usage: npm run validate-env
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Define required environment variables for Phase 3
const REQUIRED_ENV_VARS = {
  // Database Configuration - CRITICAL
  DATABASE_URL: {
    required: true,
    format: 'postgresql://',
    description: 'Pooled database connection for API queries',
    example: 'postgresql://neondb_owner:npg_xxx@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  },
  DATABASE_URL_UNPOOLED: {
    required: true,
    format: 'postgresql://',
    description: 'Direct database connection for Prisma migrations',
    example: 'postgresql://neondb_owner:npg_xxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require',
  },

  // Prisma Configuration
  PRISMA_CLIENT_ENGINE_TYPE: {
    required: false,
    enum: ['dataproxy', 'binary'],
    description: 'Prisma client engine type for serverless',
    example: 'dataproxy',
  },

  // API Keys and Secrets (Frontend-Safe with VITE_ prefix)
  VITE_GEMINI_API_KEY: {
    required: false,
    description: 'Gemini API key for frontend (safe to expose)',
    example: 'AIzaSyD...',
  },

  // Backend Secrets (Server-Only)
  GEMINI_API_KEY: {
    required: false,
    description: 'Gemini API key for backend',
    example: 'AIzaSyD...',
  },

  // UploadThing Configuration
  UPLOADTHING_SECRET: {
    required: false,
    description: 'UploadThing secret for file uploads',
    example: 'sk_live_...',
  },
  UPLOADTHING_APP_ID: {
    required: false,
    description: 'UploadThing app ID',
    example: 'p95t08lhll',
  },

  // Neon Auth (Phase 3)
  VITE_NEON_AUTH_URL: {
    required: false,
    format: 'https://',
    description: 'Neon Auth service URL (frontend-safe)',
    example: 'https://your-neon-auth-url.com',
  },
  NEON_AUTH_API_KEY: {
    required: false,
    description: 'Neon Auth API key (server-only)',
    example: 'neon_auth_key_xxx',
  },

  // Node Environment
  NODE_ENV: {
    required: false,
    enum: ['development', 'production', 'test'],
    description: 'Node environment',
    example: 'development',
  },
};

// Load environment variables
function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env.local');
  const env = {};

  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf-8');
    content.split('\n').forEach((line) => {
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          env[key.trim()] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    });
  }

  return env;
}

// Validate environment variables
function validateEnv() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  Environment Variable Validation (Phase 3)${colors.reset}  ║`);
  console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}\n`);

  const env = loadEnv();
  const envFile = path.join(__dirname, '..', '.env.local');

  if (!fs.existsSync(envFile)) {
    console.log(`${colors.yellow}⚠️  .env.local not found${colors.reset}`);
    console.log(`${colors.gray}Create from .env.local.template:${colors.reset}`);
    console.log(`  cp .env.local.template .env.local\n`);
  }

  let hasErrors = false;
  let hasWarnings = false;
  const results = [];

  // Check all variables
  Object.entries(REQUIRED_ENV_VARS).forEach(([key, config]) => {
    const value = env[key] || process.env[key];

    let status = 'MISSING';
    let icon = '❌';
    let message = '';

    if (value) {
      // Validate format
      if (config.format && !value.startsWith(config.format)) {
        status = 'INVALID_FORMAT';
        icon = '⚠️';
        message = `Expected format starting with: ${config.format}`;
        hasWarnings = true;
      } else if (config.enum && !config.enum.includes(value)) {
        status = 'INVALID_VALUE';
        icon = '❌';
        message = `Must be one of: ${config.enum.join(', ')}`;
        hasErrors = true;
      } else {
        status = 'OK';
        icon = '✅';
        message = 'Present';
      }
    } else if (config.required) {
      status = 'REQUIRED';
      icon = '❌';
      message = 'Required - Missing';
      hasErrors = true;
    } else {
      status = 'OPTIONAL';
      icon = '⏭️';
      message = 'Optional - Not set';
    }

    results.push({ key, status, icon, message });
  });

  // Display results
  console.log(`${colors.blue}📋 Variables Status:${colors.reset}\n`);
  results.forEach(({ key, status, icon, message }) => {
    const statusColor =
      status === 'OK' ? colors.green :
      status === 'REQUIRED' || status === 'INVALID_VALUE' ? colors.red :
      colors.yellow;

    console.log(`${icon} ${key.padEnd(35)} ${statusColor}${status.padEnd(15)}${colors.reset} ${message}`);
  });

  // Security checks
  console.log(`\n${colors.blue}🔒 Security Checks:${colors.reset}\n`);

  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  let hasGitignore = false;

  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const envLocalIgnored = gitignoreContent.includes('.env.local');
    const envIgnored = gitignoreContent.includes('.env\n') || gitignoreContent.includes('.env ');

    console.log(`${envLocalIgnored ? '✅' : '❌'} .env.local in .gitignore ${envLocalIgnored ? '' : '(MISSING)'}`);
    console.log(`${envIgnored ? '✅' : '❌'} .env in .gitignore ${envIgnored ? '' : '(MISSING)'}`);

    if (!envLocalIgnored || !envIgnored) {
      hasErrors = true;
    }
  } else {
    console.log(`${colors.red}❌ .gitignore not found${colors.reset}`);
    hasErrors = true;
  }

  // Check for hardcoded secrets
  const sourceFiles = [
    path.join(__dirname, '..', 'lib', 'neonAuth.ts'),
    path.join(__dirname, '..', 'app', 'api', 'admin', 'executive', 'route.ts'),
    path.join(__dirname, '..', 'services', 'supabase.ts'),
  ];

  const secretPatterns = [
    /['"](?:api[_-]?key|secret|token|password)['"]?\s*:\s*['"][^'"]+['"]/gi,
    /npg_[a-zA-Z0-9]+/g,
    /sk_live_[a-zA-Z0-9]+/g,
  ];

  let foundSecrets = false;
  sourceFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      secretPatterns.forEach((pattern) => {
        if (pattern.test(content)) {
          console.log(`${colors.red}❌ Potential hardcoded secret in ${path.relative(process.cwd(), file)}${colors.reset}`);
          foundSecrets = true;
          hasErrors = true;
        }
      });
    }
  });

  if (!foundSecrets) {
    console.log(`${colors.green}✅ No hardcoded secrets found${colors.reset}`);
  }

  // Summary
  console.log(`\n${colors.blue}📊 Summary:${colors.reset}\n`);

  const passCount = results.filter((r) => r.status === 'OK' || r.status === 'OPTIONAL').length;
  const warnCount = results.filter((r) => r.status === 'INVALID_FORMAT' || r.status === 'OPTIONAL').length;
  const errorCount = results.filter((r) => r.status === 'REQUIRED' || r.status === 'INVALID_VALUE').length;

  console.log(`${colors.green}✅ Valid:${colors.reset}      ${passCount}`);
  console.log(`${colors.yellow}⚠️  Warnings:${colors.reset}  ${warnCount}`);
  console.log(`${colors.red}❌ Errors:${colors.reset}    ${errorCount}`);

  if (hasErrors) {
    console.log(`\n${colors.red}❌ Validation failed - fix errors above${colors.reset}\n`);
    process.exit(1);
  }

  if (hasWarnings) {
    console.log(`\n${colors.yellow}⚠️  Validation passed with warnings - optional vars missing${colors.reset}\n`);
    process.exit(0);
  }

  console.log(`\n${colors.green}✅ All environment variables validated successfully!${colors.reset}\n`);
  process.exit(0);
}

// Run validation
validateEnv();
