// Servidor do catálogo GeoClima.
// - Entrega os arquivos estáticos (public/)
// - GET /api/produtos              -> lista do catálogo (data/produtos.json)
// - GET /api/produtos/:codigo/preco -> preço consultado no sistema Demanda
//
// O token do Demanda fica somente aqui no servidor (nunca vai para o navegador).
// Sem dependências: requer Node 18+ (usa fetch nativo).

const http = require('http');
const fs = require('fs');
const path = require('path');

carregarEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const CACHE_SEGUNDOS = Number(process.env.CACHE_SEGUNDOS ?? 60);

const DEMANDA = {
  url: (process.env.DEMANDA_API_URL || '').replace(/\/+$/, ''),
  // Caminho do endpoint de preço; {codigo} é substituído pelo código do produto.
  caminhoPreco: process.env.DEMANDA_PRECO_PATH || '/produtos/{codigo}/precos',
  token: process.env.DEMANDA_API_TOKEN || '',
  authHeader: process.env.DEMANDA_AUTH_HEADER || 'Authorization',
  authPrefixo: process.env.DEMANDA_AUTH_PREFIX ?? 'Bearer ',
  timeoutMs: Number(process.env.DEMANDA_TIMEOUT_MS) || 8000,
  // Mapeamento dos campos da resposta do Demanda (aceita caminhos com ponto, ex: "dados.preco_venda")
  campos: {
    preco: process.env.DEMANDA_CAMPO_PRECO || 'preco',
    precoPromocional: process.env.DEMANDA_CAMPO_PRECO_PROMO || 'preco_promocional',
    estoque: process.env.DEMANDA_CAMPO_ESTOQUE || 'estoque',
    parcelas: process.env.DEMANDA_CAMPO_PARCELAS || 'parcelas',
    tabelas: process.env.DEMANDA_CAMPO_TABELAS || 'tabelas',
    atualizadoEm: process.env.DEMANDA_CAMPO_ATUALIZADO || 'atualizado_em',
  },
};

const MODO_SIMULADO = !DEMANDA.url;
const cache = new Map();

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const servidor = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido' });

    if (pathname === '/api/produtos') {
      const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'produtos.json'), 'utf8'));
      return json(res, 200, { produtos, modoSimulado: MODO_SIMULADO });
    }

    const m = pathname.match(/^\/api\/produtos\/([^/]+)\/preco$/);
    if (m) {
      const codigo = decodeURIComponent(m[1]);
      if (!/^[\w.-]{1,40}$/.test(codigo)) return json(res, 400, { erro: 'Código de produto inválido' });
      try {
        return json(res, 200, await obterPreco(codigo));
      } catch (e) {
        console.error(`[demanda] falha ao consultar ${codigo}:`, e.message);
        const status = e.status === 404 ? 404 : 502;
        const erro = status === 404
          ? 'Produto não encontrado no Demanda'
          : 'Não foi possível consultar o sistema Demanda agora';
        return json(res, status, { erro });
      }
    }

    return arquivoEstatico(pathname, res);
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: 'Erro interno' });
  }
});

servidor.listen(PORT, () => {
  console.log(`Catálogo GeoClima em http://localhost:${PORT}`);
  console.log(MODO_SIMULADO
    ? 'Modo SIMULADO: defina DEMANDA_API_URL no .env para puxar preços reais do Demanda.'
    : `Preços vindos de ${DEMANDA.url}`);
});

// ---------- Preços ----------

async function obterPreco(codigo) {
  const emCache = cache.get(codigo);
  if (emCache && emCache.expira > Date.now()) return emCache.valor;

  const valor = MODO_SIMULADO ? precoSimulado(codigo) : await consultarDemanda(codigo);
  if (CACHE_SEGUNDOS > 0) cache.set(codigo, { valor, expira: Date.now() + CACHE_SEGUNDOS * 1000 });
  return valor;
}

async function consultarDemanda(codigo) {
  const url = DEMANDA.url + DEMANDA.caminhoPreco.replace('{codigo}', encodeURIComponent(codigo));
  const headers = { Accept: 'application/json' };
  if (DEMANDA.token) headers[DEMANDA.authHeader] = DEMANDA.authPrefixo + DEMANDA.token;

  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(DEMANDA.timeoutMs) });
  if (!resp.ok) {
    const e = new Error(`HTTP ${resp.status}`);
    e.status = resp.status;
    throw e;
  }
  return normalizar(await resp.json(), codigo);
}

// Converte a resposta do Demanda para o formato que o catálogo usa.
function normalizar(dados, codigo) {
  const c = DEMANDA.campos;
  const tabelas = pegar(dados, c.tabelas);
  return {
    codigo,
    preco: numero(pegar(dados, c.preco)),
    precoPromocional: numero(pegar(dados, c.precoPromocional)),
    estoque: numero(pegar(dados, c.estoque)),
    parcelas: numero(pegar(dados, c.parcelas)),
    tabelas: Array.isArray(tabelas)
      ? tabelas.map((t) => ({ nome: String(t.nome ?? t.descricao ?? t.tabela ?? ''), valor: numero(t.valor ?? t.preco) }))
          .filter((t) => t.nome && t.valor != null)
      : [],
    atualizadoEm: pegar(dados, c.atualizadoEm) || new Date().toISOString(),
    fonte: 'demanda',
  };
}

// Preços fictícios (estáveis por código) para testar o catálogo sem o Demanda.
function precoSimulado(codigo) {
  let h = 0;
  for (const ch of codigo) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = 1200 + (h % 6800);
  const temPromo = h % 3 === 0;
  return {
    codigo,
    preco: base,
    precoPromocional: temPromo ? Math.round(base * 0.9) : null,
    estoque: h % 7 === 0 ? 0 : (h % 40) + 1,
    parcelas: 10,
    tabelas: [
      { nome: 'Varejo', valor: base },
      { nome: 'Instalador', valor: Math.round(base * 0.92) },
      { nome: 'Revenda', valor: Math.round(base * 0.85) },
    ],
    atualizadoEm: new Date().toISOString(),
    fonte: 'simulado',
  };
}

// ---------- Utilitários ----------

function pegar(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function numero(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  // Aceita "1.234,56" (formato brasileiro) e "1234.56"
  const s = String(v).trim();
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
}

function json(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

function arquivoEstatico(pathname, res) {
  const raiz = path.join(__dirname, 'public');
  const alvo = path.normalize(path.join(raiz, pathname === '/' ? 'index.html' : pathname));
  if (!alvo.startsWith(raiz + path.sep)) return json(res, 403, { erro: 'Proibido' });
  fs.readFile(alvo, (err, conteudo) => {
    if (err) return json(res, 404, { erro: 'Não encontrado' });
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream' });
    res.end(conteudo);
  });
}

function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
