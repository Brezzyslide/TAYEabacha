# Case Notes Module

A comprehensive React TypeScript module for creating and managing case notes in healthcare management systems.

## Features

- **Complete Case Note Management**
  - Create detailed case notes with structured content
  - Support for different note categories (Progress Notes, Incident Reports, Medication Administration)
  - Client assignment and shift linking
  - File attachments support
  - Rich text content with minimum word count validation

- **Advanced Form Components**
  - Progress note sections with guided templates
  - Incident tracking with reference numbers
  - Medication administration logging
  - Form validation using Zod schemas
  - Auto-save functionality

- **Display Components**
  - Case note cards with priority indicators
  - Detailed view modals
  - Filter and search capabilities
  - Export functionality

## Files Included

- `CreateCaseNoteModal.tsx` - Main case note creation modal
- `CaseNoteCard.tsx` - Display component for case note summaries
- `CaseNoteDashboard.tsx` - Full dashboard with filtering and management
- `CaseNoteFilterBar.tsx` - Advanced filtering component
- `ProgressNoteSections.tsx` - Structured progress note templates
- `case-note-schema.ts` - TypeScript types and validation schemas
- `case-note-api.ts` - API integration utilities

## Tech Stack

- React 18
- TypeScript
- React Hook Form
- Zod validation
- TanStack Query for API calls
- shadcn/ui components
- Tailwind CSS
- date-fns for date handling

## Usage

```tsx
import { CreateCaseNoteModal } from './components/CreateCaseNoteModal';
import { CaseNoteDashboard } from './components/CaseNoteDashboard';

function MyComponent() {
  return (
    <div>
      <CaseNoteDashboard />
      <CreateCaseNoteModal 
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => console.log('Case note created!')}
      />
    </div>
  );
}
```

## Dependencies

Install the required packages:

```bash
npm install react-hook-form @hookform/resolvers zod @tanstack/react-query date-fns
```

## API Integration

The module expects these API endpoints:
- `GET /api/case-notes` - Fetch all case notes
- `POST /api/case-notes` - Create new case note
- `GET /api/clients` - Fetch clients for selection
- `GET /api/shifts` - Fetch available shifts

## License

MIT License