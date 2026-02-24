# 🔐 Quick Setup: Test Credentials

**Last Updated:** January 18, 2026

## ⚡ Quick Start (30 seconds)

### Option 1: Web Interface (Easiest)
1. Go to: `http://localhost:3000/setup/create-test-credentials`
2. Click **"Create Credentials"** button
3. Copy credentials from the table
4. Login and test!

### Option 2: Documentation
1. Open: [TEST_CREDENTIALS_COMPLETE.md](./TEST_CREDENTIALS_COMPLETE.md)
2. Copy any test email/password from the table
3. Go to: `http://localhost:3000/login`
4. Paste credentials and login

---

## 📋 Primary Test Accounts

Copy-paste ready:

### Admin Dashboard
```
Email:    admin@fineandcountryerp.com
Password: AdminTest123!
```

### Agent Dashboard
```
Email:    agent@fineandcountryerp.com
Password: AgentTest123!
```

### Client Dashboard
```
Email:    client@fineandcountryerp.com
Password: ClientTest123!
```

### Manager Dashboard
```
Email:    manager@fineandcountryerp.com
Password: ManagerTest123!
```

### Account/Support Dashboard
```
Email:    account@fineandcountryerp.com
Password: AccountTest123!
```

---

## ✨ What Gets Created

When you click "Create Credentials", these 9 test users are automatically created:

| Role | Count | Branch | Purpose |
|------|-------|--------|---------|
| Admin | 1 | Harare | Full system access |
| Agent | 3 | Harare, Harare, Bulawayo | Sales workflows |
| Client | 3 | Harare, Bulawayo, Harare | Property buyers |
| Manager | 1 | Bulawayo | Branch management |
| Account | 1 | Harare | Support operations |

---

## 🧪 Testing Workflows

### Complete Sales Workflow
```
1. Login as Agent → Create client → Reserve property
2. Login as Client → View reservation → Check payment
3. Login as Manager → Approve commission
```

### Multi-Branch Testing
```
1. Login as Agent (Harare)
2. Login as Agent (Bulawayo)
3. Compare branch data
```

### Admin Operations
```
1. Login as Admin
2. Access user management
3. View audit trails
4. Configure settings
```

---

## 📁 Files Created

- **CREATE_TEST_CREDENTIALS.sql** - SQL insert statements
- **TEST_CREDENTIALS_COMPLETE.md** - Full documentation (300+ lines)
- **app/api/setup/create-test-credentials/route.ts** - API endpoint
- **app/setup/create-test-credentials/page.tsx** - Web UI

---

## 🚀 Next Steps

1. **Create test credentials** (use web interface or SQL)
2. **Login with any test account**
3. **Test each dashboard** (Admin, Agent, Client, etc.)
4. **Verify functionality** (create clients, reserve properties, etc.)
5. **Check console** for any errors
6. **Review API responses** (Network tab)

---

## ⚠️ Important Notes

- ✅ Credentials are **development only**
- ✅ Delete all test users before **production deployment**
- ✅ Feature is **disabled in production** (403 error if attempted)
- ✅ All passwords follow pattern: `[Type]Test123!`
- ✅ All test users have verified emails

---

## 🗑️ Cleanup

Delete all test users before deployment:

```sql
DELETE FROM users WHERE email LIKE '%@fineandcountryerp.com' OR email LIKE '%test%';
```

Or use the web interface to delete individual users.

---

**Framework:** Next.js 15.5.9  
**Auth:** NextAuth.js 4.24.13  
**DB:** Neon PostgreSQL  
**Status:** ✅ Ready to use
