# Catálogo GeoClima

Catálogo interativo de produtos. Ao clicar num produto, abre uma janela com o preço consultado na hora no **sistema Demanda**.

## Como rodar

Precisa de Node.js 18 ou mais novo. Não tem dependências para instalar.

```bash
cp .env.example .env   # e preencha os dados do Demanda
npm start              # http://localhost:3000
```

Sem `DEMANDA_API_URL` no `.env`, o catálogo roda em **modo demonstração** com preços fictícios e mostra um aviso no topo.

## Como funciona

```
Navegador ──> server.js ──> API do Demanda
           (/api/produtos/:codigo/preco)
```

O navegador nunca fala direto com o Demanda. O `server.js` faz a consulta, então o token fica protegido no servidor e não há problema de CORS. As respostas ficam em cache por `CACHE_SEGUNDOS`.

## Cadastrar produtos

Edite `data/produtos.json`. O campo `codigo` precisa ser **o mesmo código do produto no Demanda**, porque é ele que vai na consulta de preço.

```json
{ "codigo": "SPL-12000-INV", "nome": "Split 12.000 BTU/h", "categoria": "Split Hi-Wall",
  "marca": "…", "descricao": "…", "imagem": "img/split-12000.jpg" }
```

As imagens podem ficar em `public/img/` ou ser uma URL. Produto sem imagem recebe uma ilustração genérica.

## Conectar ao Demanda

No `.env`:

| Variável | Para que serve |
|---|---|
| `DEMANDA_API_URL` | Endereço base da API |
| `DEMANDA_PRECO_PATH` | Caminho do endpoint de preço, com `{codigo}` no lugar do código |
| `DEMANDA_API_TOKEN`, `DEMANDA_AUTH_HEADER`, `DEMANDA_AUTH_PREFIX` | Autenticação |
| `DEMANDA_CAMPO_*` | Nome de cada campo no JSON de resposta (aceita `dados.preco_venda`) |

Exemplo: se o Demanda responde

```json
{ "dados": { "preco_venda": "2.499,90", "saldo": 12 } }
```

configure `DEMANDA_CAMPO_PRECO=dados.preco_venda` e `DEMANDA_CAMPO_ESTOQUE=dados.saldo`. Valores no formato brasileiro (`2.499,90`) são convertidos automaticamente. Se a resposta for muito diferente disso, ajuste a função `normalizar()` em `server.js`.
