# Demo Data Setup Guide

This guide explains how to populate your Fine & Country Zimbabwe ERP with realistic demo data.

## 📦 What's Included

The demo data seed script creates:

### Users (6 total)
- **1 Admin**: System administrator with full access
- **2 Agents**: Sales agents (John Moyo, Sarah Ncube)
- **3 Clients**: Property buyers (Michael Chikwanha, Grace Mutasa, David Sibanda)

### Developments (4 property projects)
1. **Borrowdale Brooke Estate** - Harare premium residential (45 stands)
2. **Victoria Falls View** - Exclusive tourist area (60 stands)
3. **Bulawayo Heights** - Modern suburb development (38 stands)
4. **Greendale Gardens** - Affordable housing (52 stands)

### Stands (195 total plots)
- Mix of AVAILABLE, RESERVED, and SOLD statuses
- Realistic pricing based on location
- Varying plot sizes

### Reservations (4 active)
- Different stages: PENDING, PAYMENT_PENDING, CONFIRMED
- Some with active 72-hour timers
- Mix of Agent and Company leads

### Activity Logs (8+ entries)
- User logins
- Reservations
- Payment uploads
- Status changes
- Full audit trail

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `@prisma/client` - Prisma ORM
- `tsx` - TypeScript execution
- `prisma` - Prisma CLI

### 2. Configure Database

Make sure your `.env` file has the correct database URL:

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

### 3. Push Database Schema

```bash
npm run db:push
```

This creates all tables based on your Prisma schema.

### 4. Seed Demo Data

```bash
npm run db:seed
```

This populates the database with demo data.

### 5. Reset & Reseed (Optional)

To wipe everything and start fresh:

```bash
npm run db:reset
```

⚠️ **Warning**: This will delete ALL existing data!

## 🔑 Demo Login Credentials

After seeding, you can login with these accounts:

| Role | Email | Description |
|------|-------|-------------|
| **Admin** | [email protected] | Full system access |
| **Agent** | [email protected] | Sales agent - John Moyo |
| **Agent** | [email protected] | Sales agent - Sarah Ncube |
| **Client** | [email protected] | Property buyer |
| **Client** | [email protected] | Property buyer |
| **Client** | [email protected] | Property buyer |

> **Note**: Since you're using Auth.js, you'll need to configure authentication properly. For development, you may want to add a magic link or password authentication provider.

## 📊 Expected Data Distribution

```
Developments: 4
├── Borrowdale Brooke Estate
│   ├── Total Stands: 45
│   ├── Available: 32
│   ├── Reserved: 8
│   └── Sold: 5
│
├── Victoria Falls View
│   ├── Total Stands: 60
│   ├── Available: 54
│   ├── Reserved: 3
│   └── Sold: 3
│
├── Bulawayo Heights
│   ├── Total Stands: 38
│   ├── Available: 25
│   ├── Reserved: 6
│   └── Sold: 7
│
└── Greendale Gardens
    ├── Total Stands: 52
    ├── Available: 18
    ├── Reserved: 14
    └── Sold: 20
```

## 🎯 Testing Scenarios

The demo data enables testing of:

1. **Reservation Flow**
   - Active 72-hour timers
   - Expiring reservations (< 2 hours remaining)
   - Payment pending status

2. **Agent Dashboard**
   - Pipeline management
   - Client assignment
   - Commission tracking

3. **Client Portal**
   - Property browsing
   - Reservation status
   - Payment uploads

4. **Admin Functions**
   - Payment verification
   - Stand management
   - User management
   - Audit trail review

## 🔧 Customization

To add more demo data or modify existing data, edit:

```
scripts/seed-demo-data.ts
```

Key sections:
- `USERS` - Add more users
- `DEVELOPMENTS` - Create new property projects
- `STANDS` - Adjust number or status of plots
- `RESERVATIONS` - Set up specific test scenarios
- `ACTIVITY LOGS` - Add audit trail entries

After making changes, run:

```bash
npm run db:seed
```

## 🗑️ Cleanup

To remove all demo data while keeping the schema:

```bash
npm run db:reset
```

Then seed again if needed:

```bash
npm run db:seed
```

## 🐛 Troubleshooting

### "PrismaClient is not defined"

Make sure you've generated the Prisma Client:

```bash
npx prisma generate
```

### "Database connection failed"

Check your `DATABASE_URL` in `.env`:
- Ensure the database exists
- Verify credentials
- Check SSL mode if required

### "Unique constraint violation"

The seed script uses `upsert` for users to prevent duplicates. If you still get errors:

```bash
npm run db:reset
```

This will wipe and recreate everything.

### "Cannot find module 'tsx'"

Install dependencies:

```bash
npm install
```

## 📝 Script Commands Reference

| Command | Description |
|---------|-------------|
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Populate database with demo data |
| `npm run db:reset` | Wipe database and reseed |

## 🎨 Data Characteristics

### Realistic Pricing
- Borrowdale: $85,000 - $130,000 (premium)
- Victoria Falls: $125,000 - $215,000 (exclusive)
- Bulawayo: $55,000 - $85,000 (mid-range)
- Greendale: $42,000 - $68,000 (affordable)

### Development Phases
- **READY_TO_BUILD**: Fully serviced (100%)
- **SERVICING**: Partial infrastructure (65-90%)
- **COMPLETED**: Finished and selling final plots

### Reservation States
- **PENDING**: Active timer, awaiting payment
- **PAYMENT_PENDING**: Timer stopped, proof uploaded
- **CONFIRMED**: Payment verified by admin
- **EXPIRED**: Timer ran out (auto-status)

## 🚀 Next Steps

After seeding demo data:

1. ✅ Start the development server: `npm run dev`
2. ✅ Login with demo credentials
3. ✅ Explore different user roles (Admin, Agent, Client)
4. ✅ Test the 72-hour reservation system
5. ✅ Review the audit trail in the admin panel
6. ✅ Test payment upload and verification flows

---

**Questions?** Check the main [README.md](../README.md) for full documentation.
