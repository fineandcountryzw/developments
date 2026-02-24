# Phase 1 API Quick Reference

## Overview

Four production-ready APIs providing unified Neon-backed data access for Harare and Bulawayo offices.

---

## API Endpoints

### 1. Clients API
**Base**: `GET|POST|PUT|DELETE /api/admin/clients`

```bash
# Get all clients (user's branch)
GET /api/admin/clients

# Get clients from specific branch
GET /api/admin/clients?branch=Bulawayo

# Search clients by name, email, or phone
GET /api/admin/clients?search=john

# Create client
POST /api/admin/clients
Content-Type: application/json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+263 70 123 4567",
  "branch": "Harare",
  "kyc": [],
  "ownedStands": []
}
# → Returns: { data: {...client...}, error: null, status: 201 }

# Update client
PUT /api/admin/clients
{
  "id": "client-123",
  "name": "Jane Doe",
  "phone": "+263 71 999 8888"
}
# → Returns: { data: {...updated...}, error: null, status: 200 }

# Delete client (soft delete)
DELETE /api/admin/clients
{ "id": "client-123" }
# → Returns: { data: {id, status: 'ARCHIVED'}, error: null, status: 200 }
```

**Responses**:
```json
// Success
{ "data": {...}, "error": null, "status": 201 }

// Validation error
{ "error": "Missing required fields", "code": "VALIDATION_ERROR", "status": 400 }

// Unique constraint violation
{ "error": "Client with email john@example.com already exists in Harare", 
  "code": "UNIQUE_CONSTRAINT_FAILED", "status": 409 }

// Auth required
{ "error": "Unauthorized", "status": 401 }
```

---

### 2. Payments API
**Base**: `GET|POST|PUT /api/admin/payments`

```bash
# Get all payments
GET /api/admin/payments

# Filter by office location (branch)
GET /api/admin/payments?office_location=Harare

# Filter by status
GET /api/admin/payments?status=PENDING

# Get payments for specific client
GET /api/admin/payments?clientId=client-123

# Create payment
POST /api/admin/payments
{
  "clientId": "client-123",
  "clientName": "John Doe",
  "amount": "150000.00",
  "method": "PAYNOW",
  "office_location": "Harare",
  "reference": "PAY-2025-001"
}
# → Returns: { data: {...payment...}, status: 201 }

# Update payment status
PUT /api/admin/payments
{
  "id": "payment-xyz",
  "status": "CONFIRMED"
}
# → Returns: { data: {...updated...}, status: 200 }
```

**Payment Status**: `PENDING` | `CONFIRMED` | `FAILED`  
**Methods**: `PAYNOW` | `BANK_TRANSFER` | `CASH`

---

### 3. Stands API
**Base**: `GET|POST|PUT|DELETE /api/admin/stands`

```bash
# Get all stands (user's branch)
GET /api/admin/stands

# Get stands from specific branch
GET /api/admin/stands?branch=Bulawayo

# Filter by status
GET /api/admin/stands?status=AVAILABLE

# Filter by project
GET /api/admin/stands?project=Greenstone

# Get available stands in Bulawayo
GET /api/admin/stands?branch=Bulawayo&status=AVAILABLE

# Create stand
POST /api/admin/stands
{
  "number": "1001",
  "project": "Greenstone",
  "area": 450,
  "price": "150000.00",
  "status": "AVAILABLE",
  "branch": "Harare",
  "features": ["water", "tarred"]
}
# → Returns: { data: {...stand...}, status: 201 }

# Update stand
PUT /api/admin/stands
{
  "id": "stand-xyz",
  "status": "RESERVED",
  "reserved_by": "client-123",
  "price": "155000.00"
}
# → Returns: { data: {...updated...}, status: 200 }

# Archive stand
DELETE /api/admin/stands
{ "id": "stand-xyz" }
# → Returns: { data: {id, status: 'ARCHIVED'}, status: 200 }
```

**Stand Status**: `AVAILABLE` | `RESERVED` | `SOLD` | `ARCHIVED`

---

### 4. Activity Log API
**Base**: `GET /api/admin/activity-logs`

```bash
# Get all activities from both branches (Executive view)
GET /api/admin/activity-logs

# Get activities from specific branch
GET /api/admin/activity-logs?branch=Harare

# Get activities for specific module
GET /api/admin/activity-logs?module=PAYMENTS

# Filter by timeframe (last N days)
GET /api/admin/activity-logs?days=30

# Get Bulawayo client activities from last 7 days
GET /api/admin/activity-logs?branch=Bulawayo&module=CLIENTS&days=7

# Limit results
GET /api/admin/activity-logs?limit=50
```

**Modules**: `CLIENTS` | `PAYMENTS` | `STANDS` | `DEVELOPMENTS`  
**Actions**: `CREATE` | `UPDATE` | `DELETE`

**Response**:
```json
{
  "data": [
    {
      "id": "aud-123",
      "branch": "Harare",
      "userId": "user@example.com",
      "action": "CREATE",
      "module": "CLIENTS",
      "recordId": "client-456",
      "description": "Created client John Doe",
      "changes": "{\"name\": \"John Doe\", \"email\": \"john@example.com\"}",
      "createdAt": "2025-01-15T14:32:00Z"
    }
  ],
  "metadata": {
    "total_count": 1,
    "filters": {
      "module": "CLIENTS",
      "branch": "ALL_BRANCHES",
      "days": 7
    }
  },
  "status": 200
}
```

---

## Authentication

All APIs require authentication except in development mode:

```javascript
// Production: Neon Auth required
// Development (localhost): Bypassed if NODE_ENV=development

// Example with auth token:
fetch('/api/admin/clients', {
  headers: {
    'Authorization': 'Bearer <neon-auth-token>',
    'Content-Type': 'application/json'
  }
})
```

---

## Errors

All APIs return standardized error responses:

```json
{
  "error": "Description of what went wrong",
  "code": "ERROR_CODE",
  "status": 400
}
```

**Common Codes**:
- `VALIDATION_ERROR` (400) - Missing/invalid fields
- `UNAUTHORIZED` (401) - Auth required
- `NOT_FOUND` (404) - Resource not found
- `UNIQUE_CONSTRAINT_FAILED` (409) - Duplicate unique field
- `UNKNOWN_ERROR` (500) - Server error

---

## Integration with Components

### Using in React Components

```typescript
import { supabaseMock } from '@/services/supabase';

// In component:
const [clients, setClients] = useState<Client[]>([]);

useEffect(() => {
  // Automatically calls GET /api/admin/clients
  const loadClients = async () => {
    const data = await supabaseMock.getClients('Harare');
    setClients(data);
  };
  loadClients();
}, []);

// Create new client
const handleCreateClient = async (clientData) => {
  const newClient = await supabaseMock.createClient(clientData);
  setClients([...clients, newClient]);
};
```

### Available supabaseMock Functions

```typescript
// Clients
getClients(branch?: 'Harare' | 'Bulawayo'): Promise<Client[]>
createClient(clientData: Partial<Client>): Promise<Client>

// Payments
getPayments(clientId?: string): Promise<Payment[]>
savePayment(payment: Payment): Promise<{data, error}>

// Stands
getStands(branch?: 'Harare' | 'Bulawayo'): Promise<Stand[]>

// Activity Logs
getActivityLog(opts?: {
  branch?: 'Harare' | 'Bulawayo',
  module?: string,
  days?: number,
  limit?: number
}): Promise<ActivityLog[]>
```

---

## Forensic Logging

Every API action automatically creates an ActivityLog entry:

```
CREATE /api/admin/clients
  ↓
ActivityLog {
  branch: "Harare",
  userId: "agent@fineandcountry.co.zw",
  action: "CREATE",
  module: "CLIENTS",
  recordId: "client-123",
  description: "Created client John Doe",
  changes: {...full object...},
  createdAt: 2025-01-15T14:32:00Z
}
```

**Forensic Trail Available via**:
```bash
# Executive: All changes across both offices
GET /api/admin/activity-logs

# Deep Audit: All client changes in Harare
GET /api/admin/activity-logs?branch=Harare&module=CLIENTS
```

---

## Testing Examples

### Test 1: Create Client in Harare
```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Moyo",
    "email": "alice@fineandcountry.co.zw",
    "phone": "+263 70 123 4567",
    "branch": "Harare"
  }'
```

### Test 2: Fetch All Activities (Cross-Branch)
```bash
curl http://localhost:3000/api/admin/activity-logs?days=7
```

### Test 3: Reserve Stand in Bulawayo
```bash
curl -X PUT http://localhost:3000/api/admin/stands \
  -H "Content-Type: application/json" \
  -d '{
    "id": "stand-xyz",
    "status": "RESERVED",
    "reserved_by": "client-abc"
  }'
```

---

## Performance Notes

- **Indexes**: All branch fields indexed for fast filtering
- **Limits**: Activity log capped at 1000 records per request
- **Caching**: Supabase client should cache for 5-10 seconds
- **Pagination**: Implement offset-based pagination for large datasets

---

## Migration Notes

If Neon database doesn't have tables yet:

1. **Using Neon Studio (Recommended)**:
   - Go to neon.tech dashboard
   - SQL Editor → Run CREATE TABLE statements from PHASE_1_IMPLEMENTATION_COMPLETE.md

2. **Using Prisma**:
   - Configure DATABASE_URL env variable
   - Run: `npx prisma db push`

---

## Deployment Checklist

- [ ] DATABASE_URL points to Neon pooling endpoint
- [ ] All APIs tested in development
- [ ] Cross-branch visibility verified
- [ ] Activity logs appear in forensic trail
- [ ] Build passes: `npm run build`
- [ ] Components updated to use new APIs
- [ ] Neon Auth configured (or use dev mode)
- [ ] Vercel environment variables set
- [ ] Deploy to production

