import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../data/extras.json', import.meta.url);
const required = ['day', 'category', 'name', 'description', 'mapUrl'];
const input = {
  day: process.env.INPUT_DAY?.trim(),
  category: process.env.INPUT_CATEGORY?.trim(),
  name: process.env.INPUT_NAME?.trim(),
  description: process.env.INPUT_DESCRIPTION?.trim(),
  mapUrl: process.env.INPUT_MAP_URL?.trim(),
  photoUrl: process.env.INPUT_PHOTO_URL?.trim() || '',
  instagram: process.env.INPUT_INSTAGRAM?.trim() || ''
};

for (const key of required) {
  if (!input[key]) throw new Error(`缺少必要欄位：${key}`);
}

for (const key of ['mapUrl', 'photoUrl']) {
  if (!input[key]) continue;
  const url = new URL(input[key]);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`${key} 必須是 http(s) 網址`);
}

function coordinatesFromUrl(value) {
  const decoded = decodeURIComponent(value);
  const at = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const data = decoded.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
  return data ? { lat: Number(data[1]), lng: Number(data[2]) } : {};
}

async function resolveCoordinates(value) {
  let coords = coordinatesFromUrl(value);
  if (coords.lat) return coords;
  try {
    const response = await fetch(value, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
    coords = coordinatesFromUrl(response.url);
    if (coords.lat) return coords;
    const html = await response.text();
    return coordinatesFromUrl(html);
  } catch {
    return {};
  }
}

const data = JSON.parse(await readFile(file, 'utf8'));
const now = new Date().toISOString();
const coordinates = await resolveCoordinates(input.mapUrl);
const idBase = input.name.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
const existingIndex = data.items.findIndex(item => item.day === input.day && item.name.normalize('NFKC') === input.name.normalize('NFKC'));
const item = {
  id: existingIndex >= 0 ? data.items[existingIndex].id : `${Date.now()}-${idBase}`,
  ...input,
  ...coordinates,
  createdAt: existingIndex >= 0 ? data.items[existingIndex].createdAt : now,
  updatedAt: now
};

if (existingIndex >= 0) data.items[existingIndex] = item;
else data.items.push(item);
data.updatedAt = now;

await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`${existingIndex >= 0 ? '更新' : '新增'}：${input.day} ${input.category}｜${input.name}`);
