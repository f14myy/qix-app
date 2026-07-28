import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { ReportItem } from '$lib/apiTypes';

export const load: PageLoad = async () => {
	const { reports } = await apiJson<{ reports: ReportItem[] }>('/api/admin/reports');
	return { reports };
};
