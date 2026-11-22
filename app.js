(function () {
  "use strict";

  const CFG = window.CONFIG || {};
  const PRODUTOS = (window.PRODUTOS || []).filter((p) => !(CFG.ocultarSemPreco && !(p.preco > 0)));
  const TABELA = window.TABELA || {};
  const WPP = String(CFG.whatsapp || "").replace(/\D/g, "");

  const ICONES = {
    "Queijos": "🧀",
    "Frios e Embutidos": "🥓",
    "Carnes": "🍖",
    "Laticínios": "🧈",
    "Doces e Chocolates": "🍫",
    "Conservas e Temperos": "🫒",
  };
  const icone = (p) => ICONES[p.categoria] || "🛒";

  const $ = (s) => document.querySelector(s);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const temPreco = (p) => typeof p.preco === "number" && p.preco > 0;
  const precoTxt = (p) => (temPreco(p) ? brl(p.preco) : "Sob consulta");
  const subTxt = (p, q) => (temPreco(p) ? brl(p.preco * q) : "a consultar");
  const num = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  // "QUEIJO MUSSARELA FATIADA WAGNER P4" -> "Queijo Mussarela Fatiada Wagner P4"
  const SIGLAS = new Set(["KG", "GR", "BN", "BD", "PCT", "PC", "PÇ", "RTB", "1L"]);
  const MINUSC = new Set(["de", "da", "do", "das", "dos", "com", "sem", "ao", "e", "em", "c"]);
  function nomeBonito(txt) {
    return txt.split(" ").map((w, i) => {
      const lw = w.toLowerCase();
      if (/\d/.test(w) || SIGLAS.has(w.replace(/\.$/, ""))) return w;
      if (i > 0 && MINUSC.has(lw)) return lw;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    }).join(" ");
  }
  PRODUTOS.forEach((p) => { p.nome = nomeBonito(p.descricao); p.unidade = (p.unidade || "UN").toUpperCase(); });
  const porCodigo = new Map(PRODUTOS.map((p) => [String(p.codigo), p]));

  const passo = (p) => (p.unidade === "KG" ? 0.5 : 1);
  const unTxt = (p) => (p.unidade === "KG" ? "kg" : "un");

  // ---------- Seleção (salva no navegador) ----------
  const CHAVE = "catalogo-selecao-v1";
  let selecao = {}; // codigo -> quantidade
  try { selecao = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { selecao = {}; }
  Object.keys(selecao).forEach((c) => { if (!porCodigo.has(c) || !(selecao[c] > 0)) delete selecao[c]; });
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(selecao)); } catch (e) {} }

  const itensSelecionados = () =>
    Object.keys(selecao).map((c) => ({ p: porCodigo.get(c), q: selecao[c] })).filter((i) => i.p);
  const totalDe = (itens) => itens.reduce((s, i) => s + (temPreco(i.p) ? i.p.preco * i.q : 0), 0);
  const algumSemPreco = (itens) => itens.some((i) => !temPreco(i.p));
  const totalTxt = (itens) => (itens.every((i) => !temPreco(i.p)) ? "a consultar" : brl(totalDe(itens)) + (algumSemPreco(itens) ? " + itens sob consulta" : ""));

  // ---------- WhatsApp ----------
  function abrirWhatsApp(texto) {
    const url = "https://wa.me/" + WPP + "?text=" + encodeURIComponent(texto);
    // no app Android o link é aberto direto no WhatsApp
    if (/QdiQueijoApp/.test(navigator.userAgent)) location.href = url;
    else window.open(url, "_blank", "noopener");
  }
  function linhasItens(itens, comSubtotal) {
    return itens.map((i) => {
      let l = `• ${num(i.q)} ${unTxt(i.p)} — ${i.p.nome} (cód. ${i.p.codigo})`;
      if (!temPreco(i.p)) l += "\n   (preço sob consulta)";
      else l += comSubtotal ? `\n   ${brl(i.p.preco)}/${unTxt(i.p)} = ${brl(i.p.preco * i.q)}` : `\n   ref. ${brl(i.p.preco)}/${unTxt(i.p)}`;
      return l;
    }).join("\n");
  }
  function rodape(itens) {
    let t = "";
    if (itens.some((i) => i.p.unidade === "KG")) t += "\n_Itens por kg: valor final conforme pesagem._";
    const nome = ($("#cliente").value || "").trim();
    if (nome) t += `\n\nCliente: ${nome}`;
    return t;
  }
  function msgOrcamento(itens) {
    return `Olá! Gostaria de solicitar um *orçamento* dos seguintes itens:\n\n${linhasItens(itens, false)}\n\n` +
      `Total estimado (tabela): ${totalTxt(itens)}${rodape(itens)}\n\nAguardo retorno, obrigado!`;
  }
  function msgPedido(itens) {
    return `Olá! Quero fazer o seguinte *pedido*:\n\n${linhasItens(itens, true)}\n\n` +
      `*Total: ${totalTxt(itens)}*${rodape(itens)}\n\nPode confirmar, por favor?`;
  }

  // ---------- Filtros e grade ----------
  const categorias = ["Todos", ...Array.from(new Set(PRODUTOS.map((p) => p.categoria || "Outros")))];
  let catAtual = "Todos";
  let termo = "";
  const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const navCat = $("#categorias");
  categorias.forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = c === "Todos" ? "Todos" : `${ICONES[c] || "🛒"} ${c}`;
    b.setAttribute("aria-pressed", c === catAtual);
    b.onclick = () => {
      catAtual = c;
      navCat.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", x === b));
      renderGrade();
    };
    navCat.appendChild(b);
  });

  function imagemOuIcone(p) {
    if (p.imagem) {
      const img = document.createElement("img");
      img.src = p.imagem; img.alt = ""; img.loading = "lazy";
      img.onerror = () => img.replaceWith(document.createTextNode(icone(p)));
      return img;
    }
    return document.createTextNode(icone(p));
  }

  function renderGrade() {
    const t = semAcento(termo.trim());
    const lista = PRODUTOS.filter((p) =>
      (catAtual === "Todos" || p.categoria === catAtual) &&
      (!t || semAcento(p.descricao).includes(t) || String(p.codigo) === t)
    );
    const grade = $("#grade");
    grade.innerHTML = "";
    const frag = document.createDocumentFragment();
    lista.forEach((p) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "card" + (selecao[p.codigo] ? " sel" : "");
      b.dataset.codigo = p.codigo;
      const ico = document.createElement("div");
      ico.className = "card-ico";
      ico.appendChild(imagemOuIcone(p));
      b.appendChild(ico);
      b.insertAdjacentHTML("beforeend",
        `<span class="card-nome"></span><span class="card-cod">Cód. ${p.codigo}</span>` +
        `<span class="card-ver">Ver preço</span>` +
        `<span class="card-check" aria-hidden="true">✓</span>`);
      b.querySelector(".card-nome").textContent = p.nome;
      b.onclick = () => abrirProduto(p);
      li.appendChild(b);
      frag.appendChild(li);
    });
    grade.appendChild(frag);
    $("#vazio").hidden = lista.length > 0;
    $("#contagem").textContent = `${lista.length} ${lista.length === 1 ? "produto" : "produtos"}`;
  }

  $("#busca").addEventListener("input", (e) => { termo = e.target.value; renderGrade(); });

  // ---------- Barra / contador ----------
  function atualizarResumo() {
    const itens = itensSelecionados();
    const n = itens.length;
    $("#badge").hidden = n === 0;
    $("#badge").textContent = n;
    $("#barra").hidden = n === 0;
    $("#barra-qtd").textContent = `${n} ${n === 1 ? "item selecionado" : "itens selecionados"}`;
    $("#barra-total").textContent = "Total estimado " + totalTxt(itens);
    document.querySelectorAll(".card").forEach((c) => c.classList.toggle("sel", !!selecao[c.dataset.codigo]));
  }

  // ---------- Janela do produto ----------
  const jProd = $("#janela-produto");
  const inpQtd = $("#p-qtd");
  let atual = null;

  function lerQtd(input, p) {
    let q = parseFloat(String(input.value).replace(",", "."));
    if (!(q > 0)) q = passo(p);
    return Math.round(q * 1000) / 1000;
  }

  function atualizarJanelaProduto() {
    const p = atual;
    const q = lerQtd(inpQtd, p);
    $("#p-subtotal").textContent = subTxt(p, q);
    const sel = !!selecao[p.codigo];
    const bSel = $("#p-selecionar");
    bSel.classList.toggle("on", sel);
    bSel.textContent = sel ? "✓ Na seleção — toque para remover" : "+ Adicionar à seleção";
    // orçamento sempre inclui este produto junto dos já selecionados
    const n = itensParaOrcamento().length;
    $("#p-orc-qtd").textContent = `(${n} ${n === 1 ? "item" : "itens"})`;
  }

  function itensParaOrcamento() {
    const q = lerQtd(inpQtd, atual);
    const itens = itensSelecionados().filter((i) => i.p.codigo !== atual.codigo);
    return [{ p: atual, q }, ...itens];
  }

  function abrirProduto(p) {
    atual = p;
    const ic = $("#p-icone");
    ic.innerHTML = "";
    ic.appendChild(imagemOuIcone(p));
    $("#p-cat").textContent = p.categoria || "";
    $("#p-nome").textContent = p.nome;
    $("#p-cod").textContent = `Código ${p.codigo}`;
    $("#p-preco").textContent = precoTxt(p);
    $("#p-unid").textContent = !temPreco(p) ? "consulte o valor pelo WhatsApp" : p.unidade === "KG" ? "por kg" : "por unidade";
    $("#p-aviso").hidden = p.unidade !== "KG";
    inpQtd.step = passo(p);
    inpQtd.min = passo(p);
    inpQtd.value = selecao[p.codigo] || 1;
    $("#p-qtd-un").textContent = unTxt(p);
    atualizarJanelaProduto();
    jProd.showModal();
  }

  jProd.querySelectorAll("[data-step]").forEach((b) => {
    b.onclick = () => {
      const s = passo(atual) * Number(b.dataset.step);
      inpQtd.value = Math.max(passo(atual), lerQtd(inpQtd, atual) + s);
      onQtdProduto();
    };
  });
  function onQtdProduto() {
    if (selecao[atual.codigo]) { selecao[atual.codigo] = lerQtd(inpQtd, atual); salvar(); atualizarResumo(); }
    atualizarJanelaProduto();
  }
  inpQtd.addEventListener("input", onQtdProduto);

  $("#p-selecionar").onclick = () => {
    if (selecao[atual.codigo]) delete selecao[atual.codigo];
    else selecao[atual.codigo] = lerQtd(inpQtd, atual);
    salvar(); atualizarResumo(); atualizarJanelaProduto();
  };
  $("#p-orcamento").onclick = () => {
    // adiciona este item à seleção e pede orçamento de tudo que está selecionado
    selecao[atual.codigo] = lerQtd(inpQtd, atual);
    salvar(); atualizarResumo(); atualizarJanelaProduto();
    abrirWhatsApp(msgOrcamento(itensSelecionados()));
  };
  $("#p-pedido").onclick = () => {
    abrirWhatsApp(msgPedido([{ p: atual, q: lerQtd(inpQtd, atual) }]));
  };

  // ---------- Janela da seleção ----------
  const jSel = $("#janela-selecao");
  function renderSelecao() {
    const itens = itensSelecionados();
    const ul = $("#lista-sel");
    ul.innerHTML = "";
    itens.forEach(({ p, q }) => {
      const li = document.createElement("li");
      li.className = "item-sel";
      li.innerHTML =
        `<div><div class="nome"></div><div class="info">Cód. ${p.codigo} · ${temPreco(p) ? brl(p.preco) + "/" + unTxt(p) : "sob consulta"}</div></div>` +
        `<div class="sub-item">${subTxt(p, q)}</div>` +
        `<div class="controles"><div class="stepper"><button type="button" data-d="-1" aria-label="Diminuir">−</button>` +
        `<input type="number" inputmode="decimal" step="${passo(p)}" min="${passo(p)}" value="${q}" aria-label="Quantidade">` +
        `<span class="stepper-un">${unTxt(p)}</span><button type="button" data-d="1" aria-label="Aumentar">+</button></div>` +
        `<button class="remover" type="button">Remover</button></div>`;
      li.querySelector(".nome").textContent = p.nome;
      const inp = li.querySelector("input");
      const set = (v) => { selecao[p.codigo] = Math.max(passo(p), Math.round(v * 1000) / 1000); salvar(); atualizarResumo(); renderSelecao(); };
      li.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => set(lerQtd(inp, p) + passo(p) * Number(b.dataset.d))));
      inp.addEventListener("change", () => set(lerQtd(inp, p)));
      li.querySelector(".remover").onclick = () => { delete selecao[p.codigo]; salvar(); atualizarResumo(); renderSelecao(); };
      ul.appendChild(li);
    });
    $("#sel-vazio").hidden = itens.length > 0;
    $("#sel-rodape").hidden = itens.length === 0;
    $("#sel-total").textContent = totalTxt(itens);
  }
  function abrirSelecao() { renderSelecao(); jSel.showModal(); }
  $("#abrir-selecao").onclick = abrirSelecao;
  $("#barra-abrir").onclick = abrirSelecao;
  $("#barra-orcamento").onclick = abrirSelecao;
  $("#s-orcamento").onclick = () => abrirWhatsApp(msgOrcamento(itensSelecionados()));
  $("#s-pedido").onclick = () => abrirWhatsApp(msgPedido(itensSelecionados()));
  $("#limpar").onclick = () => { selecao = {}; salvar(); atualizarResumo(); renderSelecao(); };

  // nome do cliente lembrado no navegador
  try { $("#cliente").value = localStorage.getItem("catalogo-cliente") || ""; } catch (e) {}
  $("#cliente").addEventListener("input", (e) => { try { localStorage.setItem("catalogo-cliente", e.target.value); } catch (x) {} });

  // fechar janelas: botão ×, clique fora, Esc (nativo)
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelector("[data-fechar]").onclick = () => d.close();
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  });

  // ---------- Início ----------
  // número do WhatsApp visível: 5548988147567 -> (48) 98814-7567
  const local = WPP.replace(/^55/, "");
  const numFmt = local.length === 11 ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
    : local.length === 10 ? `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}` : local;
  document.querySelectorAll("[data-wpp-num]").forEach((e) => (e.textContent = numFmt));
  document.querySelectorAll("[data-wpp-link]").forEach((a) => (a.href = "https://wa.me/" + WPP));

  if (CFG.nomeLoja) { document.title = CFG.nomeLoja + " — Catálogo"; $(".logo").alt = CFG.nomeLoja; }
  if (TABELA.atualizadoEm) $("#data-tabela").textContent = " · " + TABELA.atualizadoEm;
  renderGrade();
  atualizarResumo();
})();
