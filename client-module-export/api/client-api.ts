// API integration for client creation
import { InsertClient, CreateClientResponse } from '../types/client-schema';

// Generic API request function
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: any
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }

  return response;
}

// Create a new client
export async function createClient(clientData: InsertClient): Promise<CreateClientResponse> {
  const response = await apiRequest('POST', '/api/clients', clientData);
  return response.json();
}

// Get all clients (for reference)
export async function getClients(): Promise<any[]> {
  const response = await apiRequest('GET', '/api/clients');
  return response.json();
}

// Get a specific client by ID
export async function getClient(id: number): Promise<any> {
  const response = await apiRequest('GET', `/api/clients/${id}`);
  return response.json();
}