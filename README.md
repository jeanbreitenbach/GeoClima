# Catálogo digital com pedidos pelo WhatsApp

Site estático (HTML + CSS + JS, sem instalação). Abra `index.html` no navegador ou publique a pasta
em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel…).

- Toque em um produto para abrir a janela com preço, quantidade e subtotal.
- **Solicitar orçamento dos itens selecionados** — envia ao WhatsApp a lista de todos os itens selecionados.
- **Fazer pedido direto no WhatsApp** — envia o pedido do produto aberto, com quantidade e total.
- A seleção fica salva no navegador; o ícone do carrinho mostra a lista com os mesmos dois botões.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `config.js` | Número do WhatsApp (`5548988147567`), nome da loja, ocultar itens sem preço |
| `produtos.js` | Lista de produtos e preços (gerada pelo script) |
| `tools/gerar_produtos.py` | Atualiza `produtos.js` a partir do PDF da tabela ou de um CSV |

## Atualizar preços

```bash
python3 tools/gerar_produtos.py "tabela.pdf" --data 21/11/2026
```

O script mostra o que mudou (preços alterados, produtos novos e removidos).
Preço `R$ 9.999,00` na tabela é tratado como **Sob consulta**.
Também aceita CSV com colunas `codigo;descricao;preco;unidade[;categoria]`.

Para colocar foto em um produto, adicione `"imagem": "fotos/arquivo.jpg"` ao item em `produtos.js`
(a foto é mantida nas próximas atualizações).
