// Example usage of the CreateClientForm component
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateClientForm from '../components/CreateClientForm';
import SimpleCreateClientForm from '../components/SimpleCreateClientForm';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Mock authentication context (replace with your actual auth system)
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  // This should be replaced with your actual authentication provider
  const mockUser = {
    id: 1,
    tenantId: 1,
    role: 'admin',
    name: 'Demo User'
  };

  return (
    <div>
      {/* Your auth context provider would go here */}
      {children}
    </div>
  );
};

// Example 1: Basic usage with success callback
export function BasicExample() {
  const handleSuccess = () => {
    console.log('Client created successfully!');
    // Handle success (e.g., redirect, show notification, etc.)
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6">Create New Client</h1>
          <CreateClientForm onSuccess={handleSuccess} />
        </div>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

// Example 2: Simple form version
export function SimpleExample() {
  const handleSuccess = () => {
    alert('Client created successfully!');
  };

  const handleCancel = () => {
    console.log('Form cancelled');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <div className="max-w-2xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6">Quick Client Creation</h1>
          <SimpleCreateClientForm 
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

// Example 3: Modal usage
export function ModalExample() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Handle success
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <div className="p-6">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add New Client
          </button>

          {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Create New Client</h2>
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <CreateClientForm 
                    onSuccess={handleSuccess}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

export default BasicExample;