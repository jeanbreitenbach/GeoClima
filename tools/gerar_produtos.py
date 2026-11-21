#!/usr/bin/env python3
"""
Gera o arquivo produtos.js a partir da tabela de preços.

Aceita:
  - PDF do sistema (Catálogo de Produtos)  -> requer `pdftotext` (poppler-utils)
  - CSV com colunas: codigo;descricao;preco;unidade[;categoria]

Uso:
  python3 tools/gerar_produtos.py tabela.pdf  --data 26/10/2026
  python3 tools/gerar_produtos.py tabela.csv  --data 26/10/2026

Categorias são atribuídas automaticamente por palavra-chave (pode ajustar abaixo)
e, se o produto já existir em produtos.js, a categoria/imagem atuais são mantidas.
"""
import argparse, csv, json, os, re, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "produtos.js")

CATEGORIAS = [
    ("Queijos", ["QUEIJO", "MUSSARELA", "PARMESAO", "REQUEIJ", "CREAM CHEESE", "CHEDDAR", "RICOTA", "GORGONZOLA", "PROVOLONE"]),
    ("Frios e Embutidos", ["APRESUNTADO", "PRESUNTO", "SALAME", "PEPPERONI", "PEITO", "LOMBO", "LINGUIC", "BACON", "MORTADELA", "SALAMINHO"]),
    ("Carnes", ["CHULETA", "COSTELA", "LEITAO", "BARRIGA SUINA", "PERNIL", "SOBREPALETA", "PELE SUINA", "TORRESMO", "KIT FEIJOADA"]),
    ("Laticínios", ["MANTEIGA", "NATA", "CREME CULINARIO"]),
    ("Doces e Chocolates", ["CHOCOLATE", "AVELA", "DOCE DE LEITE", "MORANGO"]),
    ("Conservas e Temperos", ["AZEITONA", "COGUMELO", "PALMITO", "TOMATE", "MOLHO", "CALDO", "SAZON", "CEBOLA", "BATATA"]),
]

def categoria(desc):
    d = desc.upper()
    for nome, chaves in CATEGORIAS:
        if any(d.startswith(c) or (" " + c) in d for c in chaves):
            return nome
    return "Outros"

def preco_br(txt):
    return float(txt.replace("R$", "").strip().replace(".", "").replace(",", "."))

# preço "R$ 9.999,00" é usado pelo sistema como marcador de "sem preço" -> Sob consulta
PRECO_MARCADOR = 9999.0

def ler_pdf(caminho):
    txt = subprocess.run(["pdftotext", "-layout", caminho, "-"], capture_output=True, text=True, check=True).stdout
    # layout antigo: Valor | Código | Descrição | Emb | Valor Unidade
    antigo = re.compile(r"\s*R\$\s*([\d\.]+,\d+)/(KG|UN)\s+(\d+)\s+(.+?)\s{2,}\d+\s+R\$")
    # layout novo: Código | Descrição | Emb | Valor Unidade | Valor
    novo = re.compile(r"\s*(\d+)\s+(.+?)\s{2,}\d+\s+R\$\s*([\d\.]+,\d+)/(KG|UN)")
    itens, ultimo = [], None
    for linha in txt.splitlines():
        m = antigo.match(linha)
        if m:
            cod, desc, preco, un = m[3], m[4], m[1], m[2]
        else:
            m = novo.match(linha)
            if m:
                cod, desc, preco, un = m[1], m[2], m[3], m[4]
        if m:
            p = preco_br(preco)
            ultimo = {"codigo": cod, "descricao": re.sub(r"\s+", " ", desc.strip()),
                      "preco": None if p >= PRECO_MARCADOR else p, "unidade": un}
            itens.append(ultimo)
            continue
        s = linha.strip()
        # descrição quebrada em duas linhas
        if ultimo and s and linha.startswith(" " * 6) and "R$" not in s and not re.search(r"itens|CATÁLOGO|Valor|EMISSÃO|VENDEDOR|LISTA", s):
            ultimo["descricao"] += " " + re.sub(r"\s+", " ", s)
        ultimo = None if s else ultimo
    return itens

def ler_csv(caminho):
    with open(caminho, encoding="utf-8-sig") as f:
        amostra = f.read(2048); f.seek(0)
        dialeto = csv.Sniffer().sniff(amostra, delimiters=";,\t")
        itens = []
        for r in csv.DictReader(f, dialect=dialeto):
            r = {k.strip().lower(): (v or "").strip() for k, v in r.items()}
            un = r.get("unidade", "UN").upper()
            p = r.get("preco") or r.get("preço") or r.get("valor")
            m = re.search(r"/(KG|UN)", p.upper())
            if m: un = m[1]; p = p.upper().split("/")[0]
            item = {"codigo": r["codigo"], "descricao": r["descricao"], "preco": preco_br(p), "unidade": un}
            if r.get("categoria"): item["categoria"] = r["categoria"]
            itens.append(item)
        return itens

def ler_existente():
    if not os.path.exists(SAIDA):
        return {}
    txt = open(SAIDA, encoding="utf-8").read()
    m = re.search(r"window\.PRODUTOS\s*=\s*(\[.*?\]);", txt, re.S)
    return {p["codigo"]: p for p in json.loads(m[1])} if m else {}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tabela")
    ap.add_argument("--data", help="data da tabela (ex.: 26/10/2026)")
    a = ap.parse_args()
    itens = ler_pdf(a.tabela) if a.tabela.lower().endswith(".pdf") else ler_csv(a.tabela)
    antigos = ler_existente()
    for it in itens:
        velho = antigos.get(it["codigo"], {})
        it.setdefault("categoria", velho.get("categoria") or categoria(it["descricao"]))
        if velho.get("imagem"): it["imagem"] = velho["imagem"]
        if velho and velho.get("preco") != it["preco"]:
            fmt = lambda v: "sob consulta" if v is None else f"R$ {v:.2f}"
            print(f"  {it['codigo']:>4} {it['descricao'][:45]:45} {fmt(velho.get('preco'))} -> {fmt(it['preco'])}")
    novos = [i for i in itens if i["codigo"] not in antigos]
    removidos = [p for c, p in antigos.items() if c not in {i["codigo"] for i in itens}]
    for i in novos: print(f"  + novo: {i['codigo']} {i['descricao']}")
    for p in removidos: print(f"  - removido: {p['codigo']} {p['descricao']}")

    data = a.data
    if not data and os.path.exists(SAIDA):
        m = re.search(r'atualizadoEm:\s*"([^"]*)"', open(SAIDA, encoding="utf-8").read())
        data = m[1] if m else ""
    corpo = ",\n".join("  " + json.dumps(i, ensure_ascii=False) for i in itens)
    with open(SAIDA, "w", encoding="utf-8") as f:
        f.write("// Arquivo gerado por tools/gerar_produtos.py — pode editar à mão também.\n")
        f.write(f'window.TABELA = {{ atualizadoEm: "{data or ""}" }};\n\n')
        f.write(f"window.PRODUTOS = [\n{corpo}\n];\n")
    print(f"{len(itens)} produtos gravados em produtos.js")

if __name__ == "__main__":
    main()
