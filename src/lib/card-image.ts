// Small image for listing cards. The source images are full size (the default cover is 1.6 MB);
// cards show them at 400px or less, so use the WebP versions that already sit next to them.
export function cardImage(src?: string) {
  if (!src) return src;
  if (src === '/scaling-legends-cover.jpg') return '/scaling-legends-cover-630.webp';
  const m = src.match(/^\/img\/editorial\/([\w-]+)\.jpg$/);
  if (m) return `/img/editorial/${m[1]}-480.webp`;
  return src;
}
