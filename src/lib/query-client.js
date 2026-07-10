import { QueryClient } from '@tanstack/react-query';
import { hydrateGalleryCacheSync } from '@/lib/gallery-cache-hydrate';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

hydrateGalleryCacheSync(queryClientInstance);