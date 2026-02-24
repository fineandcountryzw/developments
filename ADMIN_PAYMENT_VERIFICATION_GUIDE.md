# 👨‍💼 Admin Payment Verification Workflow

**Quick Reference for Harare & Bulawayo Branch Admins**

---

## 📱 Daily Workflow

### Morning Routine (9:00 AM)

1. **Check Notification Bell** (Top Right)
   - Red badge = New payment verifications needed
   - Click to view pending payments

2. **Open Admin Dashboard**
   - Navigate to "Payment Verification" tab
   - Filter by: "Pending Verification"

3. **Review Overnight Payments**
   - Sort by: "Oldest First"
   - Priority: Red (< 6h remaining before timer expires)

---

## 💰 Verifying Payments

### Paynow Payments (Auto-Verified)

```
✅ Status: "Paid via Paynow"
✅ Action: No verification needed
✅ Next Step: Generate AOS document
```

**What You See:**
- Green badge: "Payment Verified ✓"
- Timer: Stopped
- Payment Method: Paynow
- Reference: PAYNOW_1234567890

**Your Action:**
1. Click "Generate AOS"
2. System auto-fills Stand details
3. Click "Issue AOS to Client"

---

### Manual Payments (Require Verification)

```
⚠️ Status: "Payment Pending Verification"
⚠️ Action: Check bank account & verify
⚠️ Timer: PAUSED ⏸️
```

**What You See:**
- Amber badge: "Timer Paused - Verification Needed"
- Payment Method: Bank Transfer / RTGS / Cash
- Uploaded Proof: [VIEW PDF] button
- Stand Number: e.g., 103
- Amount: e.g., $15,000
- Branch: Harare or Bulawayo

**Your Action Steps:**

#### Step 1: Open Proof of Payment
```
Click [VIEW PDF] → Opens in new tab
```

**Check Document Contains:**
- ✅ Bank name (Standard Chartered, CBZ, etc.)
- ✅ Transaction date (within last 72 hours)
- ✅ Amount matches reservation price
- ✅ Reference includes Stand Number
- ✅ Client name matches profile

#### Step 2: Verify in Bank Account
```
Login to Online Banking → Check Transactions
```

**Match These Details:**
| Field | Expected |
|-------|----------|
| Amount | Exact match to reservation |
| Date | Within last 72 hours |
| Reference | Contains "STAND-103" or similar |
| Sender Name | Matches client name |

#### Step 3: Approve or Reject

**If All Correct:**
```
1. Click "Verify Payment" button
2. Add verification note (optional):
   "Confirmed via Standard Chartered - Ref: 12345"
3. Click "Confirm Verification"
```

**System Updates:**
- ✅ Status → "Payment Verified"
- ✅ Timer → Permanently stopped
- ✅ Client notified via email
- ✅ AOS generation unlocked

**If Issues Found:**
```
1. Click "Reject Payment"
2. Select reason:
   ☐ Amount mismatch
   ☐ Receipt unclear/illegible
   ☐ No funds received in bank
   ☐ Wrong account/branch
   ☐ Other (specify)
3. Add detailed note for client
4. Click "Send Rejection Notice"
```

**System Updates:**
- ⏯️ Timer → Resumes counting
- 📧 Client notified with rejection reason
- 🔄 Client can re-upload corrected proof

---

## ⏰ Timer Management

### Understanding Timer States

| Icon | Status | Meaning | Your Action |
|------|--------|---------|-------------|
| 🟢 | Active (> 24h) | Client has time | Monitor normally |
| 🟡 | Expiring Soon (< 24h) | Getting urgent | Prioritize verification |
| 🔴 | Payment Urgent (< 6h) | Critical! | IMMEDIATE verification needed |
| ⏸️ | Timer Paused | POP uploaded | Verify within 24 hours |
| ✅ | Paid | Verified | Generate AOS |
| ❌ | Expired | Too late | Stand released |

### What "Timer Paused" Means

**When client uploads POP:**
- 72-hour countdown STOPS immediately
- Stand remains reserved (not available to others)
- You have 24 hours to verify (internal SLA)
- Client sees: "Timer Paused - Payment Verification"

**After you verify:**
- Timer permanently stops
- Status changes to "Payment Verified"
- Client unlocked for AOS issuance

---

## 🚨 Priority Rules

### Verification Order

1. **RED - Payment Urgent (< 6h)**
   - Drop everything
   - Verify within 1 hour
   - If bank closed, call client for alternative proof

2. **AMBER - Expiring Soon (< 24h)**
   - Verify by end of business day
   - Email client if issues found

3. **YELLOW - Timer Paused**
   - Verify within 24 hours
   - Standard verification process

4. **GREEN - Active (> 24h)**
   - Monitor for payment uploads
   - No action needed yet

---

## 📞 When to Contact Client

### Scenario 1: Unclear Receipt
```
Issue: Photo is blurry, can't read amount
Action: 
1. Click "Request Clearer Document"
2. Timer remains PAUSED (no penalty)
3. Client re-uploads → you re-verify
```

### Scenario 2: Amount Mismatch
```
Issue: Client paid $14,500 but stand is $15,000
Action:
1. Call client: "We received $14,500. Balance: $500"
2. Options:
   a) Client pays balance → verify when received
   b) Client provides corrected receipt → verify
   c) Refund if client cancels
```

### Scenario 3: Wrong Bank Account
```
Issue: Client deposited to Bulawayo account but reserved Harare stand
Action:
1. Contact Finance to transfer funds between branches
2. Once transferred, verify payment
3. Add note: "Inter-branch transfer completed"
```

### Scenario 4: No Payment Found
```
Issue: Receipt looks valid but no funds in account
Action:
1. Double-check account statement (24h delay possible)
2. Call bank to confirm (EcoCash/RTGS delays)
3. If confirmed fraud → reject + report
4. If bank delay → extend verification window
```

---

## 📊 Daily Reports

### End-of-Day Checklist

**Before Leaving Office:**

- [ ] All red/amber verifications completed
- [ ] Zero unread notifications
- [ ] Bank account balance matches verified payments
- [ ] Reconciliation sheet updated
- [ ] Tomorrow's priority list prepared

**Report to Branch Manager:**
```
Today's Stats:
- Paynow Payments: 5 (Auto-verified)
- Manual Verified: 8 (Bank: 6, RTGS: 2)
- Pending: 2 (Yellow - will verify tomorrow)
- Rejected: 1 (Amount mismatch - client notified)
- AOS Issued: 12
```

---

## 🔐 Bank Details Reference

### Harare Branch
```
Bank: Standard Chartered Bank
Account Name: Fine & Country Zimbabwe Ltd
Account Number: 0123456789
Branch Code: HARARE-001
Swift: SCBLZWHAXXX
```

### Bulawayo Branch
```
Bank: Standard Chartered Bank
Account Name: Fine & Country Zimbabwe Ltd
Account Number: 9876543210
Branch Code: BULAWAYO-002
Swift: SCBLZWHAXXX
```

---

## 🐛 Troubleshooting

### Problem: "Cannot find payment proof file"

**Solution:**
1. Check Supabase Storage → payment-proofs bucket
2. If missing, ask client to re-upload
3. Check file permissions (RLS policy)

### Problem: "Timer still counting after verification"

**Solution:**
1. Refresh page (Ctrl+R / Cmd+R)
2. Check `timer_paused = TRUE` in database
3. Contact IT if persists

### Problem: "Notification badge stuck at 3"

**Solution:**
1. Click each notification to mark as read
2. Refresh notifications panel
3. Clear browser cache if persists

---

## 📚 Training Resources

### Video Tutorials
- Payment Verification 101 (5 mins)
- Handling Rejection Cases (3 mins)
- Bank Reconciliation Process (8 mins)

### Knowledge Base
- [How to Read Bank Receipts](link)
- [RTGS vs EcoCash Identification](link)
- [Fraud Detection Red Flags](link)

---

## 🆘 Support Contacts

**Technical Issues:**
- IT Support: it@fineandcountry.co.zw
- Ext: 105 (Harare) / 205 (Bulawayo)

**Finance Queries:**
- Finance Manager: finance@fineandcountry.co.zw
- Ext: 103 (Harare) / 203 (Bulawayo)

**Paynow Issues:**
- Paynow Support: support@paynow.co.zw
- Tel: +263 24 2251 111

**Bank Issues:**
- Standard Chartered:
  - Harare: +263 24 2758 451
  - Bulawayo: +263 29 2246 811

---

## ✅ Best Practices

### DO ✅
- Verify within 24 hours of upload
- Add detailed verification notes
- Double-check amount matches exactly
- Call client if document unclear
- Keep reconciliation sheet updated
- Mark notifications as read after action

### DON'T ❌
- Verify without checking bank account
- Approve partial payments without agreement
- Let red/amber timers expire
- Ignore weekend uploads (check Monday AM)
- Forget to notify client of rejection
- Share bank details publicly

---

## 📅 Weekly Tasks

**Every Monday:**
- Review weekend uploads
- Clear backlog from Friday
- Update bank balance sheet

**Every Friday:**
- Generate weekly payment report
- Reconcile all week's transactions
- Flag any discrepancies to Finance

---

**Last Updated:** December 28, 2025  
**Version:** 1.0  
**Next Training:** January 15, 2026 (Fraud Detection)
