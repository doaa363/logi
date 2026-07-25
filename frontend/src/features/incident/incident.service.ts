import api from "../../api/axios";

export const incidentService = {
  listIncidents: async () => {
    
    const response = await api.get<{ success: boolean; data: any[] }>('/incidents');
    return response.data;
  },
  
  getIncidentById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: any }>(`/incidents/${id}`);
    return response.data;
  },
  
  createIncident: async (payload: any) => {
    const response = await api.post<{ success: boolean; data: any }>('/incidents', payload);
    return response.data;
  },
  
  updateIncidentStatus: async (id: string, status: string) => {
    const response = await api.patch<{ success: boolean; data: any }>(`/incidents/${id}/status`, { status });
    return response.data;
  },
};