# Reservation Email Notification System

## Overview

The Fine & Country Zimbabwe ERP includes a comprehensive email notification system for reservation lifecycle events. Emails are automatically sent to relevant stakeholders when reservations are created, cancelled, or converted to sales.

## Email Recipients by Event

| Event | Client | Developer | Internal Ops | Agent |
|-------|--------|-----------|--------------|-------|
| **Reservation Created** | ✅ Confirmation | ✅ New reservation alert | ✅ Summary | ✅ Commission alert |
| **Reservation Cancelled** | ✅ Notification | ✅ Stand released alert | ✅ Summary | ✅ Lost opportunity |
| **Sale Confirmed** | ✅ Congratulations | ✅ Sale completed alert | ✅ Full summary | ✅ Commission earned |

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```env
# Email Configuration (Required)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# From Address (Optional - defaults shown)
AUTH_EMAIL_FROM=noreply@fineandcountryerp.com

# Internal Operations Email (Optional - defaults shown)
INTERNAL_OPS_EMAIL=operations@fineandcountry.co.zw
```

### Database Requirements

The following fields must be populated for full email functionality:

#### Development Model
- `developerEmail` - Developer's email address (for notifications)
- `developerName` - Developer's name (for email personalization)

#### Client Model
- `email` - Client's email address (required)
- `name` - Client's name (for personalization)
- `phone` - Client's phone number (optional, included in notifications)

#### Agent/User Model
- `email` - Agent's email address
- `name` - Agent's name

## Technical Implementation

### Files

| File | Purpose |
|------|---------|
| `lib/reservation-emails.ts` | Core email service with branded templates |
| `app/api/admin/reservations/route.ts` | API endpoints with email integration |

### Core Functions

```typescript
// Send all "reservation created" emails
await sendReservationCreatedEmails(emailData);

// Send all "reservation cancelled" emails
await sendReservationCancelledEmails(emailData, 'Reason for cancellation');

// Send all "sale confirmed" emails
await sendSaleConversionEmails(emailData);
```

### ReservationEmailData Interface

```typescript
interface ReservationEmailData {
  reservationId: string;
  reservationDate: Date;
  expiresAt?: Date;
  standNumber: string;
  standPrice: number;
  standSize?: number;
  developmentName: string;
  developmentLocation?: string;
  developerEmail?: string;
  developerName?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  agentName?: string;
  agentEmail?: string;
  branch?: string;
  saleAmount?: number;
  commissionRate?: number;
}
```

## API Endpoints

### POST /api/admin/reservations
Creates a new reservation and sends:
- ✅ Reservation confirmation to client
- ✅ New reservation alert to developer (if email configured)
- ✅ Internal notification to operations team
- ✅ Commission opportunity alert to agent (if assigned)

### PUT /api/admin/reservations
Updates reservation status:

**When status = CONFIRMED (sale)**
- ✅ Sale confirmation to client
- ✅ Sale completion alert to developer
- ✅ Sale summary to internal operations
- ✅ Commission earned notification to agent

**When status = CANCELLED or EXPIRED**
- ✅ Cancellation notice to client
- ✅ Stand released alert to developer
- ✅ Cancellation summary to internal operations
- ✅ Lost opportunity notice to agent

### DELETE /api/admin/reservations
Deletes/cancels reservation and sends:
- ✅ Cancellation notice to client
- ✅ Stand released alert to developer
- ✅ Cancellation summary to internal operations
- ✅ Lost opportunity notice to agent

## Email Templates

All emails use branded HTML templates with:
- Fine & Country logo header
- Consistent maroon (#722F37) and gold (#D4AF37) color scheme
- Responsive design for mobile devices
- Clear call-to-action buttons
- Professional footer with contact information

### Template Types

1. **Client Templates**
   - Reservation confirmation with next steps
   - Cancellation notice with re-reservation options
   - Sale congratulations with property details

2. **Developer Templates**
   - New reservation alert with client details
   - Stand released notification
   - Sale completion summary

3. **Internal Operations Templates**
   - Comprehensive reservation summaries
   - Full client and agent details
   - Financial information

4. **Agent Templates**
   - Commission opportunity alerts
   - Lost opportunity notices (with encouragement)
   - Commission earned confirmations

## Error Handling

- Emails are sent asynchronously to avoid blocking API responses
- Individual email failures don't affect other recipients
- All errors are logged with `[RESERVATION_EMAIL]` prefix
- Missing developer/agent emails are gracefully skipped

## Testing

### Manual Testing

1. Create a reservation with valid client email
2. Check inbox for confirmation email
3. Cancel the reservation
4. Check inbox for cancellation email
5. Create another reservation and confirm as sale
6. Check inbox for sale confirmation

### Test Checklist

- [ ] Client receives reservation confirmation
- [ ] Client receives cancellation notice
- [ ] Client receives sale confirmation
- [ ] Developer receives alerts (if email configured)
- [ ] Internal ops receives summaries
- [ ] Agent receives commission notifications
- [ ] All emails render correctly on mobile
- [ ] Email links work correctly

## Customization

### Adding New Email Types

1. Create new template function in `lib/reservation-emails.ts`
2. Create corresponding `send*` function
3. Call from appropriate API endpoint

### Modifying Templates

Edit the HTML template functions in `lib/reservation-emails.ts`:
- `getClientReservationCreatedTemplate()`
- `getDeveloperReservationCreatedTemplate()`
- `getInternalReservationCreatedTemplate()`
- `getAgentReservationCreatedTemplate()`
- (Similar for cancelled and sale templates)

### Brand Customization

Update color constants at the top of `lib/reservation-emails.ts`:
```typescript
const BRAND_COLORS = {
  maroon: '#722F37',
  gold: '#D4AF37',
  darkGray: '#333333',
  lightGray: '#f5f5f5',
};
```

## Troubleshooting

### Emails Not Sending

1. Verify `RESEND_API_KEY` is set correctly
2. Check console logs for `[RESERVATION_EMAIL]` errors
3. Verify email addresses are valid
4. Check Resend dashboard for delivery status

### Missing Recipient Emails

1. **Developer**: Ensure `developerEmail` field is set on the Development record
2. **Agent**: Ensure agent is assigned to the reservation and has an email
3. **Client**: Ensure client has a valid email address

### Template Rendering Issues

1. Check email HTML for syntax errors
2. Test with email preview tools
3. Verify all template variables are being passed

## Future Enhancements

- [ ] Email preferences per user
- [ ] Unsubscribe functionality
- [ ] Email tracking/analytics
- [ ] SMS notifications
- [ ] WhatsApp integration
- [ ] Email templates in database (admin-editable)
- [ ] Scheduled reminder emails
- [ ] Payment milestone notifications
