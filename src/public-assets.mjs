// Vite's base also applies to files copied from public/.
export function publicAsset(path) {
 return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
