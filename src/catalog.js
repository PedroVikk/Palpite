/**
 * Catalogo dos universos: os datasets de data/ lidos uma unica vez, na subida.
 * So os jogaveis (`eligible`) entram — os demais nao viram nem chute nem
 * segredo.
 *
 * O servidor compara chute e segredo, entao guarda o item inteiro. O navegador
 * usa muito menos — nome, apelidos, miniatura e o par grupo/elegivel — porque
 * as colunas da tabela de dicas chegam prontas pelo socket. Mandar o dataset
 * cru seria 1 MB so no Yu-Gi-Oh!, entao o indice do cliente ja sai daqui
 * recortado, serializado e comprimido: uma vez, nao a cada request.
 *
 * E tambem aqui que a miniatura remota da lugar a espelhada em data/sprites/,
 * quando ela existe.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { UNIVERSES, getUniverse, scopeKeys } from '../shared/universes.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * So o que alimenta a busca do chute e o contador de sorteaveis do lobby.
 * `keys` sao as chaves do recorte do universo (o `inAnime` do Hunter x Hunter,
 * o `inClassic`/`inShippuden` do Naruto): entram so onde existem, para o lobby
 * contar e o duelo filtrar sem baixar o dataset inteiro.
 */
const forClient = (item, keys) => {
  const { id, name, sprite, group, eligible, aliases } = item;
  const lean = { id, name, sprite, group, eligible };
  if (aliases?.length) lean.aliases = aliases;
  for (const key of keys) lean[key] = item[key] === true;
  return lean;
};

function buildIndex(list, keys) {
  const body = Buffer.from(JSON.stringify(list.map(item => forClient(item, keys))));
  return {
    body,
    gzip: zlib.gzipSync(body, { level: zlib.constants.Z_BEST_COMPRESSION }),
    // conteudo fixo dentro do deploy: o hash serve de ETag forte
    etag: `"${createHash('sha1').update(body).digest('base64url')}"`,
  };
}

/**
 * Troca a URL da CDN pela miniatura espelhada em
 * data/sprites/<universo>/<id>.webp (npm run mirror:sprites). Com o espelho no
 * lugar o jogo mostra as imagens mesmo se o Fandom ou o ygoprodeck cair; quem
 * ficou de fora — falha no espelho, universo sem imagem — continua apontando
 * para a origem.
 *
 * A troca mora na leitura, e nao nos JSONs, para os build-*.mjs seguirem
 * gravando a URL de origem: assim reconstruir um dataset nao apaga o espelho
 * nem enche o diff de caminhos locais.
 */
function useMirror(list, universeId) {
  let files;
  try {
    files = new Set(fs.readdirSync(path.join(ROOT, 'data', 'sprites', universeId)));
  } catch {
    return 0;   // universo ainda nao espelhado
  }
  let mirrored = 0;
  for (const item of list) {
    if (!files.has(`${item.id}.webp`)) continue;
    item.sprite = `/sprites/${universeId}/${item.id}.webp`;
    mirrored++;
  }
  return mirrored;
}

const catalog = new Map();

for (const universe of Object.values(UNIVERSES)) {
  const bruto = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', universe.dataFile), 'utf8'));
  // quem nao pode ser o segredo tambem nao entra na busca de chute: oferecer o
  // figurante de um episodio so nao dava dica nenhuma, so enchia a lista e
  // gastava o turno de quem chutou
  const list = bruto.filter(item => item.eligible);
  const mirrored = useMirror(list, universe.id);
  const index = buildIndex(list, scopeKeys(universe));
  catalog.set(universe.id, { list, byId: new Map(list.map(item => [item.id, item])), index });
  console.log(
    `${universe.label}: ${list.length} jogáveis`
    + ` (de ${bruto.length} no dataset,`
    + ` ${mirrored} miniaturas locais,`
    + ` índice ${(index.gzip.length / 1024).toFixed(0)} KB comprimido)`
  );
}

/** Dataset completo da sala; universo desconhecido cai no padrao, como getUniverse. */
export const datasetOf = (universeId) => catalog.get(universeId) ?? catalog.get(getUniverse().id);

/** Indice enxuto para o navegador — null quando o universo nao existe. */
export const indexOf = (universeId) => catalog.get(universeId)?.index ?? null;
