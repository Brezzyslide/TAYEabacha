# Client Creation Module

A React TypeScript component for creating client profiles in healthcare management systems.

## Features

- **Comprehensive Client Data Collection**
  - Personal information (name, DOB, address)
  - NDIS number and care level
  - Emergency contact details
  - Medical information and allergies
  - Client preferences and goals

- **Form Validation**
  - Required field validation using Zod schemas
  - Date validation
  - Form error handling

- **Modern UI Components**
  - Built with React Hook Form
  - shadcn/ui components for consistent design
  - Responsive layout
  - Loading states and success notifications

## Files Included

- `CreateClientForm.tsx` - Main client creation form component
- `SimpleCreateClientForm.tsx` - Simplified version of the form
- `client-schema.ts` - TypeScript types and validation schemas
- `package-dependencies.json` - Required npm packages

## Tech Stack

- React 18
- TypeScript
- React Hook Form
- Zod validation
- TanStack Query for API calls
- shadcn/ui components
- Tailwind CSS

## Usage

```tsx
import CreateClientForm from './CreateClientForm';

function MyComponent() {
  return (
    <CreateClientForm 
      onSuccess={() => console.log('Client created!')}
    />
  );
}
```

## Dependencies

Install the required packages:

```bash
npm install react-hook-form @hookform/resolvers zod @tanstack/react-query
```

## API Integration

The form expects a POST endpoint at `/api/clients` that accepts client data and returns the created client object.

## License

MIT License