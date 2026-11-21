const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const el = {
  grade: document.getElementById('grade'),
  busca: document.getElementById('busca'),
  categoria: document.getElementById('categoria'),
  contagem: document.getElementById('contagem'),
  aviso: document.getElementById('aviso-simulado'),
  modal: document.getElementById('modal'),
  mImagem: document.getElementById('modal-imagem'),
  mCategoria: document.getElementById('modal-categoria'),
  mTitulo: document.getElementById('modal-titulo'),
  mCodigo: document.getElementById('modal-codigo'),
  mDescricao: document.getElementById('modal-descricao'),
  mPreco: document.getElementById('modal-preco'),
};

let produtos = [];
let consultaAtual = null; // evita que uma resposta antiga sobrescreva o modal

iniciar();

async function iniciar() {
  try {
    const resp = await fetch('/api/produtos');
    const dados = await resp.json();
    produtos = dados.produtos;
    el.aviso.hidden = !dados.modoSimulado;

    const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();
    for (const c of categorias) el.categoria.add(new Option(c, c));

    renderizar();
  } catch {
    el.grade.innerHTML = '<p class="vazio">Não foi possível carregar o catálogo.</p>';
  }
}

el.busca.addEventListener('input', renderizar);
el.categoria.addEventListener('change', renderizar);

function renderizar() {
  const termo = normalizarTexto(el.busca.value);
  const cat = el.categoria.value;
  const lista = produtos.filter((p) =>
    (!cat || p.categoria === cat) &&
    (!termo || normalizarTexto(`${p.nome} ${p.codigo} ${p.marca ?? ''}`).includes(termo)));

  el.contagem.textContent = `${lista.length} ${lista.length === 1 ? 'produto' : 'produtos'}`;
  el.grade.replaceChildren(...lista.map(cartao));
  if (!lista.length) el.grade.innerHTML = '<p class="vazio">Nenhum produto encontrado.</p>';
}

function cartao(p) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'produto';
  b.innerHTML = `
    <div class="imagem">${imagemHTML(p)}</div>
    <div class="info">
      <span class="etiqueta">${esc(p.categoria)}</span>
      <h3>${esc(p.nome)}</h3>
      <p class="codigo">Cód. ${esc(p.codigo)}</p>
      <span class="ver-preco">Ver preço →</span>
    </div>`;
  b.addEventListener('click', () => abrirProduto(p));
  return b;
}

function abrirProduto(p) {
  el.mImagem.innerHTML = imagemHTML(p);
  el.mCategoria.textContent = p.categoria;
  el.mTitulo.textContent = p.nome;
  el.mCodigo.textContent = p.codigo;
  el.mDescricao.textContent = p.descricao || '';
  el.modal.showModal();
  carregarPreco(p);
}

async function carregarPreco(p) {
  const id = (consultaAtual = Symbol());
  el.mPreco.innerHTML = '<div class="carregando"><span class="spinner"></span> Consultando preço no Demanda…</div>';

  try {
    const resp = await fetch(`/api/produtos/${encodeURIComponent(p.codigo)}/preco`);
    const dados = await resp.json();
    if (id !== consultaAtual) return;
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao consultar preço');
    el.mPreco.innerHTML = precoHTML(dados);
  } catch (e) {
    if (id !== consultaAtual) return;
    el.mPreco.innerHTML = `
      <p class="erro">${esc(e.message || 'Erro ao consultar preço')}</p>
      <button type="button" class="botao">Tentar novamente</button>`;
    el.mPreco.querySelector('.botao').addEventListener('click', () => carregarPreco(p));
  }
}

function precoHTML(d) {
  if (d.preco == null && d.precoPromocional == null) {
    return '<p class="erro">Preço não cadastrado no Demanda para este produto.</p>';
  }
  const temPromo = d.precoPromocional != null && d.preco != null && d.precoPromocional < d.preco;
  const final = temPromo ? d.precoPromocional : (d.preco ?? d.precoPromocional);

  let h = '';
  if (temPromo) h += `<div class="preco-de">${brl.format(d.preco)}</div>`;
  h += `<div class="preco-principal">${brl.format(final)}</div>`;
  if (d.parcelas > 1) h += `<div class="parcelado">ou ${d.parcelas}x de ${brl.format(final / d.parcelas)}</div>`;

  if (d.estoque != null) {
    h += d.estoque > 0
      ? `<div class="estoque ok">Em estoque (${d.estoque} un.)</div>`
      : '<div class="estoque sem">Sem estoque</div>';
  }

  if (d.tabelas?.length) {
    h += '<table class="tabelas"><tbody>' +
      d.tabelas.map((t) => `<tr><th>${esc(t.nome)}</th><td>${brl.format(t.valor)}</td></tr>`).join('') +
      '</tbody></table>';
  }

  const quando = new Date(d.atualizadoEm);
  const origem = d.fonte === 'simulado' ? 'Demonstração' : 'Sistema Demanda';
  h += `<p class="rodape-preco">${origem}${isNaN(quando) ? '' : ` · atualizado em ${dataHora.format(quando)}`}</p>`;
  return h;
}

// Fecha o modal com o botão ×, ao clicar fora ou com Esc (nativo do <dialog>)
el.modal.querySelector('.fechar').addEventListener('click', () => el.modal.close());
el.modal.addEventListener('click', (e) => { if (e.target === el.modal) el.modal.close(); });
el.modal.addEventListener('close', () => { consultaAtual = null; });

function imagemHTML(p) {
  if (p.imagem) return `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">`;
  return `<img src="${placeholder(p)}" alt="" aria-hidden="true">`;
}

// Ilustração genérica quando o produto ainda não tem foto
function placeholder(p) {
  const btu = (p.nome.match(/([\d.]+)\s*BTU/i) || [])[1] || '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaf3fa"/><stop offset="1" stop-color="#d4e8f5"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g)"/>
    <rect x="70" y="95" width="260" height="80" rx="16" fill="#fff" stroke="#b9d3e6" stroke-width="3"/>
    <rect x="95" y="150" width="210" height="8" rx="4" fill="#cfe2f0"/>
    <circle cx="300" cy="118" r="5" fill="#1fb6d6"/>
    <path d="M130 200 q10 14 0 28 M200 200 q10 14 0 28 M270 200 q10 14 0 28" stroke="#1fb6d6" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${btu ? `<text x="200" y="80" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#0b5fa5">${btu} BTU</text>` : ''}
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function normalizarTexto(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
