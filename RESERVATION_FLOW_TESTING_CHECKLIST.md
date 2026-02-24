# Reservation Flow - Testing Checklist

## 🧪 Pre-Deployment Testing Guide

### Environment
- [x] Dev server running at http://localhost:3002
- [x] No TypeScript compilation errors
- [x] No console errors on page load
- [ ] All dependencies installed (`npm install`)
- [ ] Database connected (Neon PostgreSQL)

---

## 📋 Functional Tests

### Modal Trigger Tests
- [ ] **Map Click:** Click green (available) stand on development map → Modal opens
- [ ] **List Reserve Button:** Click "Reserve" button on stand card → Modal opens
- [ ] **Multiple Triggers:** Both triggers open the same unified modal
- [ ] **Stand Data:** Stand number, price, area correctly displayed in header

### Step 1: Legal Gate Advisory
- [ ] **Rendering:** All 3 compliance cards visible (72Hr, Deposit, KYC)
- [ ] **Timer Badge:** Amber "72H Security Lock" badge displays
- [ ] **Auto-Release Warning:** Yellow warning box visible
- [ ] **Checkbox:** Acknowledgment checkbox toggleable
- [ ] **Button State:** Button disabled when unchecked, enabled when checked
- [ ] **Validation:** Alert shows if clicking "I UNDERSTAND & ACCEPT" without checking
- [ ] **Navigation:** Successful navigation to Step 2 after checking and clicking

### Step 2: Reservation Attribution
- [ ] **Default Selection:** "Self-Led / Direct" pre-selected with gold highlight
- [ ] **Agent Option:** Clicking "Agent Assisted" shows agent search input
- [ ] **Agent Search:** Typing filters agent list in real-time
- [ ] **Agent Selection:** Clicking agent highlights it with slate background
- [ ] **Referral Option:** Clicking "Referral Link" shows code input field
- [ ] **Referral Input:** Text converts to uppercase automatically
- [ ] **Validation - Agent:** Alert if "Agent" selected but no agent chosen
- [ ] **Validation - Referral:** Alert if "Referral" selected but no code entered
- [ ] **Navigation:** Successful navigation to Step 3 after valid selection

### Step 3: KYC Verification
- [ ] **Form Fields:** All 3 text inputs render correctly
- [ ] **Upload Zone:** Purple upload area with icon visible
- [ ] **File Upload:** Clicking "Choose File" opens file picker
- [ ] **File Types:** Accepts PDF, JPG, PNG files
- [ ] **File Size:** Rejects files over 5MB with error message
- [ ] **Upload Progress:** Loading state visible during upload
- [ ] **Success State:** Green success card shows after upload with file URL
- [ ] **Change File:** "Change" button allows re-upload
- [ ] **Validation:** Alert if any field empty or no file uploaded
- [ ] **Navigation:** Successful navigation to Step 4 after all fields complete

### Step 4: Legal Acceptance
- [ ] **Document Preview:** Scrollable legal document visible
- [ ] **Stand Details:** Stand number and price correctly inserted in document
- [ ] **Checkbox 1:** Digital Reservation Agreement checkbox toggleable
- [ ] **Checkbox 2:** Terms & Conditions checkbox toggleable
- [ ] **Legal Notice:** Amber binding notice displays
- [ ] **Button State:** Red "EXECUTE" button disabled until both checked
- [ ] **Loading State:** Spinner shows during 1.5s execution delay
- [ ] **Validation:** Alert if clicking execute without both checkboxes
- [ ] **Navigation:** Automatic transition to Step 5 after execution

### Step 5: Success Confirmation
- [ ] **Success Icon:** Large green checkmark displays
- [ ] **Digital Ref:** Unique reference number generated (XXX-XXXXX format)
- [ ] **Countdown Timer:** Shows "72h remaining" or similar format
- [ ] **Timer Active:** Countdown decrements every second
- [ ] **Info Card:** Gold gradient card with digital ref and timer
- [ ] **Next Steps:** All 3 numbered steps visible
- [ ] **Enter Dashboard Button:** Slate button at bottom
- [ ] **Navigation:** Clicking "ENTER DASHBOARD" redirects to /dashboards/client

### Modal Behavior
- [ ] **Open Animation:** Smooth fade-in and scale-in (300ms)
- [ ] **Close Button:** X button in header closes modal (except Step 5)
- [ ] **Backdrop Click:** Clicking outside modal closes it (except Step 5)
- [ ] **Step Transitions:** Smooth fade between steps (300ms)
- [ ] **Progress Stepper:** Numbers 1-4 highlight correctly as steps advance
- [ ] **Progress Lines:** Lines between steps fill with gold on completion
- [ ] **Escape Key:** Pressing ESC closes modal (except Step 5)
- [ ] **No Close on Step 5:** Users must click "ENTER DASHBOARD" to exit

---

## 📱 Responsive Tests

### Mobile (375px width)
- [ ] **Modal Fit:** Modal fits screen with margins (mx-4)
- [ ] **Header:** Stand info and close button visible
- [ ] **Progress Stepper:** All step numbers visible (may scroll)
- [ ] **Content Scroll:** Content area scrollable if overflows
- [ ] **Form Inputs:** Text inputs full width, easy to tap
- [ ] **Buttons:** Tall buttons (py-4) for easy tapping
- [ ] **Upload:** File picker opens on mobile browser
- [ ] **Step 5 Timer:** Fits on screen without overflow

### Tablet (768px width)
- [ ] **Modal Width:** Max-width 2xl (672px) centered
- [ ] **All Elements:** Standard sizing, no truncation
- [ ] **Two-Column Layouts:** Agent search/selection displays properly
- [ ] **Hover States:** Work on touch (sticky on tap)

### Desktop (1440px width)
- [ ] **Modal Centered:** Perfect center with blurred backdrop
- [ ] **Hover Effects:** All buttons show hover states
- [ ] **Cursor States:** Changes to pointer on clickable elements
- [ ] **Typography:** All text readable at 1x zoom

---

## 🎨 Visual Tests

### Colors & Branding
- [ ] **Font:** Inter font applied throughout
- [ ] **Gold Color:** Matches fcGold (#D4AF37) from constants
- [ ] **Slate Color:** Matches fcSlate (dark gray)
- [ ] **Status Colors:** Amber, blue, green, purple, red used correctly
- [ ] **Gradients:** Header gradient (slate-900 → slate-800) renders smoothly

### Typography
- [ ] **Headers:** Font-black, tracking-tight applied
- [ ] **Labels:** Uppercase, tracking-widest, font-bold applied
- [ ] **Body Text:** Leading-relaxed for readability
- [ ] **Buttons:** Font-bold on all action buttons

### Spacing
- [ ] **Consistent Padding:** p-6 on all major sections
- [ ] **Card Gaps:** space-y-6 between major cards
- [ ] **Form Gaps:** space-y-4 between form elements
- [ ] **No Overflow:** No horizontal scrollbars

### Animations
- [ ] **Smooth Transitions:** All state changes animate smoothly
- [ ] **No Jank:** No layout shifts or reflows
- [ ] **Loading States:** Spinners render without blocking

---

## 🔧 Integration Tests

### Data Flow
- [ ] **Stand Data Passed:** Selected stand object reaches modal correctly
- [ ] **Agent List Loaded:** Agents fetched and displayed in Step 2
- [ ] **File Upload URL:** UploadThing returns valid URL in Step 3
- [ ] **Reservation Data:** All data logged in console on execution
- [ ] **Callback Triggered:** `onConfirm` called with correct parameters

### API Tests
- [ ] **UploadThing Endpoint:** `identityDocument` endpoint accepts files
- [ ] **File Storage:** Uploaded files accessible via returned URL
- [ ] **Error Handling:** Upload errors show user-friendly messages
- [ ] **Forensic Logging:** Console shows all [FORENSIC] log entries

### State Persistence
- [ ] **Step State:** Current step maintained correctly
- [ ] **Form State:** All field values persist during step navigation
- [ ] **Agent Selection:** Selected agent persists if going back
- [ ] **File URL:** Uploaded file URL persists if going back

---

## 🛡️ Security Tests

### Input Validation
- [ ] **XSS Prevention:** Special characters in inputs don't break UI
- [ ] **SQL Injection:** Database queries parameterized (when implemented)
- [ ] **File Type Validation:** Only PDF/JPG/PNG accepted
- [ ] **File Size Validation:** Files over 5MB rejected

### Data Privacy
- [ ] **No Sensitive Logs:** Personal data not logged to console (except forensic)
- [ ] **Upload Security:** Files uploaded to secure UploadThing CDN
- [ ] **URL Sanitization:** File URLs validated before display

---

## ⚠️ Error Handling Tests

### Network Errors
- [ ] **Upload Failure:** Clear error message if upload fails
- [ ] **Retry Option:** User can retry failed upload
- [ ] **Offline Mode:** Graceful degradation if offline
- [ ] **Timeout Handling:** Long uploads show loading state

### User Errors
- [ ] **Empty Fields:** Clear validation messages
- [ ] **Invalid File:** File type error shows immediately
- [ ] **Missing Selection:** Agent/referral validation alerts clear
- [ ] **Multiple Errors:** All errors shown, not just first one

### Edge Cases
- [ ] **No Agents:** Step 2 still works with "Self-Led" only
- [ ] **Large Agent List:** Agent search filters correctly with 100+ agents
- [ ] **Long Stand Names:** Truncation or wrapping handles overflow
- [ ] **Timer Expiry:** Timer stops at 0:00 (doesn't go negative)

---

## 📊 Performance Tests

### Load Times
- [ ] **Modal Open:** < 100ms from click to first paint
- [ ] **Step Transition:** < 300ms animation duration
- [ ] **File Upload:** Progress indicator for uploads > 1MB
- [ ] **Image Rendering:** Stand images lazy-loaded

### Memory
- [ ] **No Leaks:** Closing modal cleans up event listeners
- [ ] **Timer Cleanup:** Countdown interval cleared on unmount
- [ ] **File Cleanup:** Uploaded files don't accumulate in memory

---

## 🧹 Cleanup Tests

### Component Unmount
- [ ] **Event Listeners:** All window listeners removed
- [ ] **Timers:** All setInterval/setTimeout cleared
- [ ] **State Reset:** Modal state resets on close
- [ ] **No Zombie Listeners:** No listeners on closed modal

### Browser Compatibility
- [ ] **Chrome:** All features work
- [ ] **Firefox:** All features work
- [ ] **Safari:** All features work (especially file upload)
- [ ] **Edge:** All features work
- [ ] **Mobile Safari:** Touch events and file picker work

---

## ✅ Sign-Off Checklist

### Before Deployment
- [ ] All functional tests pass
- [ ] All responsive tests pass
- [ ] All visual tests pass
- [ ] All integration tests pass
- [ ] All security tests pass
- [ ] All error handling tests pass
- [ ] All performance tests pass
- [ ] All cleanup tests pass
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] No console errors/warnings
- [ ] Build succeeds without warnings

### Post-Deployment
- [ ] Monitor error tracking (Sentry/similar)
- [ ] Check user analytics (reservation completion rate)
- [ ] Verify email notifications sent
- [ ] Confirm database records created
- [ ] Test on production URL
- [ ] Verify file uploads work in production
- [ ] Check SSL certificates for UploadThing
- [ ] Monitor server logs for errors

---

## 🐛 Known Issues

_(None currently - document any discovered issues here)_

---

## 📝 Notes

### Test Environment
- **Node Version:** 18.x or higher
- **npm Version:** 9.x or higher
- **Database:** Neon PostgreSQL (serverless)
- **File Storage:** UploadThing CDN

### Test Data
- **Test Stand:** R-251 (or any green/available stand)
- **Test Agent:** Any agent from fetched list
- **Test Referral Code:** REF-12345 (format: REF-XXXXX)
- **Test ID Upload:** Sample PDF < 5MB

### Automated Testing (Future)
```bash
# Run E2E tests (Playwright/Cypress)
npm run test:e2e

# Run unit tests
npm run test:unit

# Run visual regression tests
npm run test:visual
```

---

**Last Updated:** January 2025  
**Tester:** _[Your Name]_  
**Date Tested:** _[Date]_  
**Status:** ⏳ Pending Testing
