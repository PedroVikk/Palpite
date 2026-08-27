/**
 * Catalogo dos universos: os datasets de data/ lidos uma unica vez, na subida.
 *
 * O servidor compara chute e segredo, entao guarda o item inteiro. O navegador
 * usa muito menos — nome, apelidos, miniatura e o par grupo/elegivel — porque
 * as colunas da tabela de dicas chegam prontas pelo socket. Mandar o dataset
 * cru seria 1 MB so no Yu-Gi-Oh!, entao o indice do cliente ja sai daqui
 * recortado, serializado e comprimido: uma vez, nao a cada request.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { UNIVERSES, getUniverse } from '../shared/universes.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** So o que alimenta a busca do chute e o contador de sorteaveis do lobby. */
const forClient = ({ id, name, sprite, group, eligible, aliases }) => (
  aliases?.length
    ? { id, name, sprite, group, eligible, aliases }
    : { id, name, sprite, group, eligible }
);

function buildIndex(list) {
  const body = Buffer.from(JSON.stringify(list.map(forClient)));
  return {
    body,
    gzip: zlib.gzipSync(body, { level: zlib.constants.Z_BEST_COMPRESSION }),
    // conteudo fixo dentro do deploy: o hash serve de ETag forte
    etag: `"${createHash('sha1').update(body).digest('base64url')}"`,
  };
}

const catalog = new Map();

for (const universe of Object.values(UNIVERSES)) {
  const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', universe.dataFile), 'utf8'));
  const index = buildIndex(list);
  catalog.set(universe.id, { list, byId: new Map(list.map(item => [item.id, item])), index });
  console.log(
    `${universe.label}: ${list.length} itens`
    + ` (${list.filter(i => i.eligible).length} sorteáveis,`
    + ` índice ${(index.gzip.length / 1024).toFixed(0)} KB comprimido)`
  );
}

/** Dataset completo da sala; universo desconhecido cai no padrao, como getUniverse. */
export const datasetOf = (universeId) => catalog.get(universeId) ?? catalog.get(getUniverse().id);

/** Indice enxuto para o navegador — null quando o universo nao existe. */
export const indexOf = (universeId) => catalog.get(universeId)?.index ?? null;
