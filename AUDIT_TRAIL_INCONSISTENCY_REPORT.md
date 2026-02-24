## AUDIT TRAIL INCONSISTENCY FOUND

### Two Different Audit Tables Are Being Used:

1. **auditTrail** - Used by:
   - User management (invitations, account creation, deletion, revocation)
   - 12 entries logged ✅

2. **activityLog** - Used by:
   - Developer stands
   - Admin stands
   - Admin reservations
   - Admin installments
   - Admin activity-logs
   - Admin users (some operations)
   - Only 2 entries logged ⚠️

3. **activity** - Unused (0 entries)

### PROBLEM:
The `/api/admin/audit-trail` endpoint queries `activityLog`, but most user management actions log to `auditTrail`. This causes a disconnect - admins can't see the invitation/user actions!

### SOLUTION NEEDED:
Either:
1. **Option A**: Make all APIs log to `auditTrail` (primary)
2. **Option B**: Make UI query BOTH tables and merge results
3. **Option C**: Migrate auditTrail entries to activityLog for consistency

### RECOMMENDATION:
Option C - consolidate to single table. The `auditTrail` table has more detailed tracking (resourceId, resourceType, details), making it better suited for compliance.
