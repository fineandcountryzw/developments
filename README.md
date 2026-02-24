
# Fine & Country Zimbabwe ERP (v2.7.0-MOBILE)
## Forensic Version Control Protocol

## Documentation
- Central index: [docs/README.md](docs/README.md)
- Overview: [docs/overview/README.md](docs/overview/README.md)
- Guides: [docs/guides/README.md](docs/guides/README.md)
- References: [docs/references/README.md](docs/references/README.md)
- Checklists: [docs/checklists/README.md](docs/checklists/README.md)
- Summaries: [docs/summaries/README.md](docs/summaries/README.md)

This repository serves as the central orchestration node for the **Fine & Country Zimbabwe ERP**. All regional developers (Harare VPC & Bulawayo VPC) must adhere to the following forensic commit standards.

---

## 🎯 Latest Release: v2.7.0 - Mobile Stand Reservation UX
**Released:** December 27, 2025

### Touch-Optimized Reservation Interface
Redesigned stand selection for mobile devices with drawer-based UX:

- **Bottom Drawer System**: Slide-up sheet replaces centered modals (swipe-to-close)
- **44x44px Touch Targets**: iOS/Android HIG compliant for fat-finger prevention
- **48h Reservation Timer**: Countdown banner at drawer top for reserved stands
- **Price per m² Display**: Total price + per-square-meter breakdown
- **Legal Gate**: Mandatory checkboxes for refund policy & payment terms
- **Sticky Reserve Button**: Pinned to drawer bottom, enabled only when terms accepted
- **Promo Badges**: High-contrast red gradient for "On Promotion" stands
- **Skeleton Loaders**: Prevent layout shift during data fetch
- **Color Coding**: Green (Available), Amber (Reserved), Gray (Sold)
- **Inter Sans Typography**: Consistent font-family across mobile UI
- **Safe Area Padding**: Support for notched devices (iPhone X+)
- **Forensic Logging**: Touch device detection & screen size tracking

**Technical Implementation:**
- `MobileInventory.tsx` component with gesture detection
- Device detection: `window.innerWidth < 768 || 'ontouchstart' in window`
- Swipe threshold: 100px for drawer dismissal
- Max drawer height: 85vh to prevent full-screen takeover
- Conditional rendering: Mobile drawer vs desktop modal

---

## Version History

### v2.7.0 - Mobile Stand Reservation UX
- Touch-optimized bottom drawer for mobile devices
- 44x44px minimum touch targets
- Swipe-to-close gesture support
- Legal gate with mandatory checkboxes
- Price per m² display in drawer
- Promo badge integration

### v2.6.0 - Premium Listing Features
- Marketing badge system (Coming Soon, On Promotion, Sold Out)
- Price per square metre auto-calculation
- Corner ribbon badges with gradients
- Conditional promo stands input

### v2.5.0 - Client Investment Terminal & Agent Dashboard
- Multi-role dashboard system (Agent/Client/Admin)
- Client portfolio tracking with statement generation
- Agent pipeline management with Kanban workflow
- Commission tracking and analytics

### 1. The Forensic Commit Standard
We utilize **Conventional Commits** to ensure that our repository history remains a legible, audit-ready manifest for both technical and executive stakeholders.

**Structure:** `<type>(<scope>): <description>`

- `feat`: A new feature for the ERP (e.g., `feat(clients): add regional distinction for HRE/BYO`)
- `fix`: A bug fix (e.g., `fix(payments): resolve manual receipt column error`)
- `docs`: Documentation updates (e.g., `docs(architecture): update manual with version control protocol`)
- `refactor`: Code changes that neither fix bugs nor add features.
- `chore`: Maintenance tasks (updating dependencies, etc.)

### 2. Regional Branching
- `main`: Production-ready code. Handled by the Lead Architect.
- `dev-hre`: Harare regional development node.
- `dev-byo`: Bulawayo regional development node.

### 3. CI/CD Pipeline
Every merge to `main` triggers a **Forensic Deployment Cycle** via GitHub Actions, which:
1. Validates schema integrity.
2. Synchronizes the Plus Jakarta Sans interaction layer.
3. Broadcasts a system-wide "Integrity Pulse" update.

---
*Confidentiality Notice: This repository contains proprietary real estate logic for the Zimbabwe jurisdiction.*
