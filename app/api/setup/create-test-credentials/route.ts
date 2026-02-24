/**
 * Test Credentials Setup Route
 * Access: POST /api/setup/create-test-credentials
 * 
 * WARNING: This is for development only!
 * Should be removed before production deployment.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const TEST_CREDENTIALS = [
  {
    id: 'admin-test-001',
    name: 'Admin User',
    email: 'admin@fineandcountryerp.com',
    password: 'AdminTest123!',
    role: 'ADMIN',
    branch: 'Harare',
  },
  {
    id: 'agent-test-001',
    name: 'John Agent',
    email: 'agent@fineandcountryerp.com',
    password: 'AgentTest123!',
    role: 'AGENT',
    branch: 'Harare',
  },
  {
    id: 'agent-test-002',
    name: 'Peter Agent',
    email: 'peter.agent@fineandcountryerp.com',
    password: 'AgentTest123!',
    role: 'AGENT',
    branch: 'Bulawayo',
  },
  {
    id: 'agent-test-003',
    name: 'Sandra Agent',
    email: 'sandra.agent@fineandcountryerp.com',
    password: 'AgentTest123!',
    role: 'AGENT',
    branch: 'Harare',
  },
  {
    id: 'client-test-001',
    name: 'Jane Client',
    email: 'client@fineandcountryerp.com',
    password: 'ClientTest123!',
    role: 'CLIENT',
    branch: 'Harare',
  },
  {
    id: 'client-test-002',
    name: 'Michael Client',
    email: 'michael.client@fineandcountryerp.com',
    password: 'ClientTest123!',
    role: 'CLIENT',
    branch: 'Bulawayo',
  },
  {
    id: 'client-test-003',
    name: 'Victoria Client',
    email: 'victoria.client@fineandcountryerp.com',
    password: 'ClientTest123!',
    role: 'CLIENT',
    branch: 'Harare',
  },
  {
    id: 'manager-test-001',
    name: 'Robert Manager',
    email: 'manager@fineandcountryerp.com',
    password: 'ManagerTest123!',
    role: 'MANAGER',
    branch: 'Bulawayo',
  },
  {
    id: 'account-test-001',
    name: 'Sarah Account',
    email: 'account@fineandcountryerp.com',
    password: 'AccountTest123!',
    role: 'ACCOUNT',
    branch: 'Harare',
  },
];

export async function POST(request: NextRequest) {
  try {
    // Security check: Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Test credentials cannot be created in production' },
        { status: 403 }
      );
    }

    const results = [];

    for (const cred of TEST_CREDENTIALS) {
      try {
        const hashedPassword = await bcrypt.hash(cred.password, 10);

        const user = await prisma.user.upsert({
          where: { email: cred.email },
          update: {
            name: cred.name,
            role: cred.role as any,
            branch: cred.branch,
            isActive: true,
            emailVerified: new Date(),
            password: hashedPassword,
          },
          create: {
            id: cred.id,
            name: cred.name,
            email: cred.email,
            role: cred.role as any,
            branch: cred.branch,
            isActive: true,
            emailVerified: new Date(),
            password: hashedPassword,
          },
        });

        results.push({
          success: true,
          email: user.email,
          role: user.role,
          message: `✅ ${user.role} created`,
        });
      } catch (error: any) {
        results.push({
          success: false,
          email: cred.email,
          error: error.message,
          message: `❌ Failed to create ${cred.email}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test credentials created successfully',
      count: results.filter((r) => r.success).length,
      results,
      credentials: TEST_CREDENTIALS.map((c) => ({
        email: c.email,
        password: c.password,
        role: c.role,
        branch: c.branch,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Security check
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get test users
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'test' } },
          { email: { contains: '@fineandcountryerp.com' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      count: testUsers.length,
      users: testUsers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
