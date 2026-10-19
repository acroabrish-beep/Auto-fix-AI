# Implementation Plan - STEP 9: Technical Repair Library & Integrated Guides

Complete the core "Repair" pillar of AutoFix AI by implementing a professional technical documentation hub and linking it directly to AI Diagnostic outcomes.

## Objective
To provide users with actionable, step-by-step technical repair procedures that bridge the gap between "Diagnosis" and "Execution". This fulfills the third stage of the brand promise: *Learn. Diagnose. **Repair**. Empower.*

## User Problem
Currently, after the AI identifies a potential vehicle fault, the user is given "Next Steps" but lacks the deep technical documentation (safety protocols, required tools, and detailed procedures) needed to perform the repair safely and accurately.

## Why it is the next logical step
- **Activates Existing Infrastructure**: The `repair_guides` database model and service already exist but have no UI.
- **Completes the Value Chain**: Directly connects the output of the Step 6 Diagnostics to a tangible technical resource.
- **TVET/Mechanic Value**: High-impact for students and technicians who require standardized procedures for practical learning.

## Proposed Changes

### 1. Repair Library Hub (`/repair-guides`)
- [NEW] Create a searchable and filterable hub for technical documentation.
- [NEW] Category filtering matching the platform standards (Electrical, Engine, etc.).
- [NEW] `RepairGuideCard` component showing difficulty, time, and category.

### 2. Actionable Guide View (`/repair-guides/:guideId`)
- [NEW] Comprehensive detail page featuring:
    - **Safety First**: Prominent safety notes and required PPE.
    - **Tool Kit**: List of specialized tools required for the specific job.
    - **Procedures**: Numbered, clear technical steps (persisted as JSONB/Array).
    - **System Context**: Identifying which vehicle system is affected.

### 3. Smart Integration
- [MODIFY] `DiagnosticResult.tsx`: Update the "Open Repair Guide" button to dynamically link to the library based on the AI's "Possible Causes".
- [MODIFY] `Dashboard.tsx`: Add "Technical Library" to the quick actions and sidebar.

### 4. Technical Architecture & Services
- [MODIFY] `src/services/database/repairGuides.ts`: Enhance with better search and "related guides" logic.
- [NEW] `src/hooks/useRepairGuides.ts`: Custom hook for managing library state and navigation.

## Data Model (Existing)
- **Collection**: `repair_guides`
- **Fields**: `title`, `description`, `category`, `difficulty`, `steps` (Array), `safetyNotes`, `requiredTools` (Array).

## Security Model
- **Repair Guides**: Public Read access (educational resource).
- **Modification**: Admin-only write permissions (consistent with STEP 4 audit).

## What must NOT be changed
- Existing Step 1–8 functionality.
- Branding, colors, and the "Learn" Academy structure.
- The core logic of the `diagnostic-ai` Appwrite function.

## Dependencies
- Appwrite Database Service.
- Existing `AuthContext` for identifying if a user can save/favorite guides (future enhancement).

## Verification Checklist
- [ ] Browse the Repair Library and verify all categories function correctly.
- [ ] Perform a search for a specific procedure (e.g. "Brake Pad Replacement").
- [ ] Open a guide and verify safety notes and tools are displayed clearly.
- [ ] Run a diagnostic, click "Open Repair Guide", and verify the transition to the relevant documentation.
- [ ] Verify mobile responsiveness of the multi-step technical procedures.
- [ ] Run `npm run build` and `npx tsc --noEmit`.

## Definition of Done
Users can transition seamlessly from an AI Diagnostic result to a detailed technical repair guide, allowing them to follow standardized professional procedures for vehicle maintenance and repair.
