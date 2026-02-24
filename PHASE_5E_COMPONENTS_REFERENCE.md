# Phase 5E Components Quick Reference

## Overview

Four main React components have been created for the Phase 5E Contract Generation System. Each component is production-ready with full TypeScript support and error handling.

---

## 1. TemplateEditor

**File**: `/components/contracts/TemplateEditor.tsx`
**Purpose**: Create and edit contract templates with WYSIWYG experience
**Status**: ✅ Complete

### Features

- **Template Metadata**
  - Name, description, category selection
  - Category options: property-sale, property-lease, management-agreement, listing-agreement, other

- **Content Management** (Tab)
  - Rich text editor for contract content
  - Live preview with variable highlighting
  - Supports `{{variableName}}` and `{VARIABLE_NAME}` syntax
  - Preview dialog to see how content will render

- **Variable Management** (Tab)
  - Add/remove template variables
  - Define format: text, number, date, email
  - Add descriptions for each variable
  - Quick insert buttons to add variables to content
  - List shows all defined variables with descriptions

- **Section Management** (Tab)
  - Modular sections for contract structure
  - Mark sections as optional
  - Add conditional logic support
  - Edit section content
  - Remove sections

### Usage

```tsx
import { TemplateEditor } from '@/components/contracts/TemplateEditor';

export default function TemplateEditorPage() {
  return <TemplateEditor />;
}
```

### Data Structure

```typescript
interface ContractTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: TemplateVariable[];
  sections: TemplateSection[];
  version?: number;
}

interface TemplateVariable {
  name: string;
  description: string;
  format?: 'text' | 'number' | 'date' | 'email';
}

interface TemplateSection {
  id: string;
  title: string;
  content: string;
  optional?: boolean;
  conditionalOn?: string;
}
```

### API Integration

- **GET** `/api/admin/contracts/templates` - Load existing templates
- **POST** `/api/admin/contracts/templates` - Save new template
- **PUT** `/api/admin/contracts/templates/[id]` - Update existing template

---

## 2. ContractGenerator

**File**: `/components/contracts/ContractGenerator.tsx`
**Purpose**: Multi-step wizard for generating contracts from templates
**Status**: ✅ Complete

### Features

- **Step 1: Template Selection**
  - Browse all available templates in grid view
  - Visual cards with category and version info
  - Click to select template
  - Shows template description

- **Step 2: Enter Variables**
  - Dynamic form fields based on template variables
  - Type-specific inputs:
    - Text: Standard input
    - Number: Number input
    - Date: Date picker
    - Email: Email input
  - Contract title field
  - Client ID field (or pre-populated)
  - Deal ID field (optional)
  - Notes field for additional context

- **Step 3: Review**
  - Live preview of rendered contract
  - Summary of all contract details
  - Final validation before generation
  - Back/Review buttons for navigation

- **Step 4: Confirmation**
  - Success message
  - Option to generate another contract
  - Auto-resets form after success

### Usage

```tsx
import { ContractGenerator } from '@/components/contracts/ContractGenerator';

// Basic usage
export default function GeneratorPage() {
  return <ContractGenerator />;
}

// With pre-populated IDs (from deal page)
export default function GeneratorInDeal() {
  return (
    <ContractGenerator 
      dealId="deal-123" 
      clientId="client-456" 
    />
  );
}
```

### Data Structure

```typescript
interface ContractData {
  title: string;
  templateId: string;
  clientId: string;
  dealId: string;
  variables: Record<string, string>;
  notes?: string;
}
```

### API Integration

- **GET** `/api/admin/contracts/templates` - Load templates
- **GET** `/api/admin/contracts/templates/[id]` - Load template details
- **POST** `/api/admin/contracts` - Generate contract

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dealId` | string | undefined | Pre-populate deal ID |
| `clientId` | string | undefined | Pre-populate client ID |

---

## 3. ContractViewer

**File**: `/components/contracts/ContractViewer.tsx`
**Purpose**: Display contracts with signature tracking and audit trail
**Status**: ✅ Complete

### Features

- **Header Section**
  - Contract title and status badge
  - Created date and creator
  - Signature progress bar (0-100%)
  - Signed vs required count

- **Action Buttons**
  - Download PDF (disabled if draft)
  - Send for Signature button
  - Status badge (draft/in-review/signed/executed/archived)

- **Document Tab**
  - Full contract content display
  - Formatted text with proper styling
  - Scrollable with max height
  - Print-friendly layout

- **Signatures Tab**
  - List of all signers
  - Status for each: pending, signed, declined
  - Signer name, email, role
  - Timestamps for signed documents
  - Expiry dates for pending
  - Decline reasons if applicable

- **History Tab**
  - Activity log with timestamps
  - Action descriptions
  - Actor information
  - Change tracking

- **Versions Tab**
  - Display current version number
  - Ready for version history display

### Usage

```tsx
import { ContractViewer } from '@/components/contracts/ContractViewer';

export default function ContractPage() {
  return (
    <ContractViewer 
      contractId="contract-123"
      onClose={() => console.log('closed')}
    />
  );
}
```

### Data Structure

```typescript
interface Contract {
  id: string;
  title: string;
  status: 'draft' | 'in-review' | 'signed' | 'executed' | 'archived';
  templateName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  signatures: Signature[];
  signedCount: number;
  requiredSignatures: number;
  version: number;
}

interface Signature {
  id: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  status: 'pending' | 'signed' | 'declined';
  signedAt?: string;
  declineReason?: string;
  expiresAt: string;
}

interface Activity {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;
}
```

### API Integration

- **GET** `/api/admin/contracts/[id]` - Load contract
- **GET** `/api/admin/contracts/[id]/activities` - Load activity log
- **GET** `/api/admin/contracts/[id]/download` - Download PDF
- **POST** `/api/admin/contracts/[id]/send-for-signature` - Send for signing

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `contractId` | string | Yes | ID of contract to display |
| `onClose` | function | No | Callback when closing |

---

## 4. ComplianceDashboard

**File**: `/components/contracts/ComplianceDashboard.tsx`
**Purpose**: Real-time compliance metrics, SLA tracking, and alerts
**Status**: ✅ Complete

### Features

- **Status Summary Cards** (4-column grid)
  - Draft contracts count
  - In-review contracts count
  - Signed contracts count
  - Executed contracts count
  - Icons and color-coded backgrounds

- **Key Metrics Section**
  - Total contract value (currency formatted)
  - Overdue signatures count (in red)
  - Expiring in 30 days count (in yellow)

- **SLA Performance Card**
  - Average time to sign (days)
  - Average time to execute (days)
  - On-time signing rate (%)
    - Green (≥95%), Yellow (80-94%), Red (<80%)
  - On-time execution rate (%) with similar badges

- **Pending Signatures Section**
  - Scrollable list of pending signatures
  - Shows signer name and role
  - Highlights overdue items in red
  - Days overdue indicator
  - Contract title for context
  - Email address
  - Max height with scroll for many items

- **Critical Alerts Section**
  - Only displays if alerts exist
  - Shows contracts with >5 days overdue signatures
  - Red styling for high visibility
  - Lists affected signer details
  - Actionable information

### Usage

```tsx
import { ComplianceDashboard } from '@/components/contracts/ComplianceDashboard';

// Default branch
export default function Dashboard() {
  return <ComplianceDashboard />;
}

// Custom branch
export default function BranchDashboard() {
  return <ComplianceDashboard branch="Bulawayo" />;
}
```

### Data Structure

```typescript
interface AnalyticsSummary {
  total: number;
  byStatus: Record<string, number>;
  totalValue: number;
  overdueSignatures: number;
  expiringThirtyDays: number;
}

interface SLAMetrics {
  averageTimeToSign: number;
  averageTimeToExecute: number;
  onTimeSigningRate: number;
  onTimeExecutionRate: number;
}

interface PendingItem {
  contractId: string;
  contractTitle: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  daysOverdue: number;
  isOverdue: boolean;
}

interface Alert {
  contractId: string;
  contractTitle: string;
  signerName: string;
  daysOverdue: number;
}
```

### API Integration

- **GET** `/api/admin/contracts/analytics/summary?branch={branch}` - Load summary metrics
- **GET** `/api/admin/contracts/analytics/pending?branch={branch}` - Load pending signatures

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `branch` | string | 'Harare' | Branch to display metrics for |

---

## Import Statements

All components use shadcn/ui components. Ensure your project has shadcn/ui installed:

```bash
npm install -D @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-alert-dialog
```

### Common Imports

```typescript
// From shadcn/ui
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Icons
import { Plus, Save, Eye, X, Send, Download, Lock, CheckCircle, AlertCircle, Clock, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';
```

---

## Styling Notes

- All components use Tailwind CSS
- Responsive design with mobile/tablet/desktop breakdowns
- Color scheme matches existing Fine & Country branding
- Consistent spacing and typography
- Dark mode compatible via shadcn/ui configuration

---

## Error Handling

All components include:
- ✅ Loading states
- ✅ Error messages
- ✅ Try-catch blocks
- ✅ User feedback via alerts
- ✅ Graceful fallbacks

---

## Performance Optimizations

- Lazy loading of templates and contracts
- Pagination on list views
- Memoized callbacks where appropriate
- Optimized re-renders
- Scrollable sections for large lists

---

## Testing Recommendations

### Unit Tests
- Component rendering
- State management
- Event handlers
- Form submissions

### Integration Tests
- API calls to endpoints
- Data flow between components
- Multi-step workflows

### E2E Tests
- Template creation → contract generation → signing
- Dashboard metrics accuracy
- Signature workflow completion

---

## Accessibility (WCAG 2.1)

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Color not sole indicator of status
- Sufficient color contrast ratios
- Responsive text sizing

---

## Next Steps

1. **SignatureWidget** (Planned)
   - Canvas-based signature pad
   - Integration with ContractViewer

2. **ContractManagement** (Planned)
   - List view with filters and search
   - Bulk actions

3. **Testing**
   - Unit tests for each component
   - Integration tests with APIs
   - E2E workflow testing

4. **Documentation**
   - Storybook stories for each component
   - Component prop documentation
   - Usage examples