/**
 * Samples one representative colour out of an image, in the browser.
 *
 * Used when someone uploads a banner or an avatar: the colour is worked out here
 * and stored next to the image, so every later viewer of that profile gets the
 * colour for free instead of downloading the picture and decoding it themselves.
 *
 * The naive approach — average every pixel — is wrong for exactly the images
 * people use as banners. Average a sunset and you get grey; average a photo with
 * a bright sky and you get pale blue. What reads as "the colour of this picture"
 * is its dominant *hue*, at a saturation and lightness that works as an accent.
 * So: bucket by hue, weight each pixel by how colourful it is, take the winning
 * bucket, then force the result into a usable range.
 */

/** Sampling grid. 48×48 is ~2300 pixels — plenty, and decodes instantly. */
const GRID = 48;
const HUE_BUCKETS = 24;

/** Accent range. Outside these a colour is either mud or neon. */
const MIN_SAT = 0.32;
const MAX_SAT = 0.86;
const MIN_LIGHT = 0.36;
const MAX_LIGHT = 0.62;

type Rgb = { r: number; g: number; b: number };

function toHex({ r, g, b }: Rgb): string {
	const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
	return `#${part(r)}${part(g)}${part(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return { h: 0, s: 0, l };
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
	else if (max === gn) h = ((bn - rn) / d + 2) / 6;
	else h = ((rn - gn) / d + 4) / 6;
	return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
	if (s === 0) {
		const v = l * 255;
		return { r: v, g: v, b: v };
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const channel = (t: number) => {
		let tt = t;
		if (tt < 0) tt += 1;
		if (tt > 1) tt -= 1;
		if (tt < 1 / 6) return p + (q - p) * 6 * tt;
		if (tt < 1 / 2) return q;
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
		return p;
	};
	return {
		r: channel(h + 1 / 3) * 255,
		g: channel(h) * 255,
		b: channel(h - 1 / 3) * 255
	};
}

/**
 * Pulls the sampled colour into the accent range: keep the hue, force enough
 * saturation to read as a colour, and enough contrast against both themes.
 */
function clampToAccent(rgb: Rgb): string {
	const { h, s, l } = rgbToHsl(rgb);
	// A fully grey image has no hue worth keeping — return a neutral slate
	// rather than inventing a colour out of rounding noise.
	if (s < 0.06) return toHex(hslToRgb(0, 0, Math.min(MAX_LIGHT, Math.max(MIN_LIGHT, l))));
	return toHex(
		hslToRgb(
			h,
			Math.min(MAX_SAT, Math.max(MIN_SAT, s)),
			Math.min(MAX_LIGHT, Math.max(MIN_LIGHT, l))
		)
	);
}

async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
	if (typeof createImageBitmap === 'function') {
		return createImageBitmap(source);
	}
	// Safari below 17 has no createImageBitmap for Blobs.
	const url = URL.createObjectURL(source);
	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('decode failed'));
			img.src = url;
		});
	} finally {
		// The bitmap is already in the element; revoking now is safe and avoids
		// leaking the object URL when the caller drops the result.
		URL.revokeObjectURL(url);
	}
}

/**
 * Returns `#rrggbb` for the image, or null if it cannot be read.
 *
 * Never throws: a colour is a nice-to-have, and a profile save must not fail
 * because a canvas was unavailable or the file was not really an image.
 */
export async function sampleImageColor(file: Blob): Promise<string | null> {
	if (typeof document === 'undefined') return null;
	try {
		const bitmap = await decode(file);
		const canvas = document.createElement('canvas');
		canvas.width = GRID;
		canvas.height = GRID;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return null;
		ctx.drawImage(bitmap as CanvasImageSource, 0, 0, GRID, GRID);
		if ('close' in bitmap) bitmap.close();

		const { data } = ctx.getImageData(0, 0, GRID, GRID);

		// Per hue bucket: summed weight, and the weighted colour sum.
		const weight = new Float64Array(HUE_BUCKETS);
		const sumR = new Float64Array(HUE_BUCKETS);
		const sumG = new Float64Array(HUE_BUCKETS);
		const sumB = new Float64Array(HUE_BUCKETS);

		// Fallback for images with no colour at all.
		let flatR = 0;
		let flatG = 0;
		let flatB = 0;
		let flatN = 0;

		for (let i = 0; i < data.length; i += 4) {
			const a = data[i + 3];
			if (a < 128) continue;
			const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
			flatR += rgb.r;
			flatG += rgb.g;
			flatB += rgb.b;
			flatN++;

			const { h, s, l } = rgbToHsl(rgb);
			// Near-black and near-white pixels carry no usable hue, and letterbox
			// bars and blown-out skies are made of them.
			if (l < 0.12 || l > 0.94) continue;
			// Weight by colourfulness so a small vivid subject beats a large dull
			// background — which is how a person would describe the image too.
			const w = s * s * (1 - Math.abs(l * 2 - 1) * 0.6);
			if (w <= 0.01) continue;
			const bucket = Math.min(HUE_BUCKETS - 1, Math.floor(h * HUE_BUCKETS));
			weight[bucket] += w;
			sumR[bucket] += rgb.r * w;
			sumG[bucket] += rgb.g * w;
			sumB[bucket] += rgb.b * w;
		}

		if (!flatN) return null;

		let best = -1;
		let bestWeight = 0;
		for (let i = 0; i < HUE_BUCKETS; i++) {
			if (weight[i] > bestWeight) {
				bestWeight = weight[i];
				best = i;
			}
		}

		if (best < 0) {
			return clampToAccent({ r: flatR / flatN, g: flatG / flatN, b: flatB / flatN });
		}

		return clampToAccent({
			r: sumR[best] / weight[best],
			g: sumG[best] / weight[best],
			b: sumB[best] / weight[best]
		});
	} catch {
		return null;
	}
}
