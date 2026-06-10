import { apiGet, apiPost, toQuery } from './systemHttp';

export const getRegulatorFilters = () => apiGet('/api/regulator/filters');
export const getRegulatorDashboard = (params: any = {}) => apiGet(`/api/regulator/dashboard${toQuery(params)}`);
export const getRegulatorLimits = () => apiGet('/api/regulator/limits');
export const createRegulatorLimit = (payload: { region: string; culture: string; minVolume: number; maxVolume: number; minPrice: number; maxPrice: number }) => apiPost('/api/regulator/limits', payload);
