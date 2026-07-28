// See https://svelte.dev/docs/kit/types#app.d.ts
//
// The app is a static SPA with no server, so there are no `Locals`. Page data is
// typed from the `+layout.ts` / `+page.ts` load functions.
declare global {
	namespace App {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface Error {
			message: string;
		}
	}
}

export {};
