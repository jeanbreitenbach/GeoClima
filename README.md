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

## Fotos dos produtos

As 66 fotos atuais foram recortadas do catálogo Canva (`Catalogo_Qdiqueijo`) e ficam em `fotos/<código>.jpg`.

Coloque as fotos na pasta `fotos/` com o **código do produto** como nome (ex.: `fotos/75.jpg`, `fotos/285.png`)
e rode o script de atualização — ele liga cada foto ao produto. Sem foto, aparece um ícone da categoria.
Os preços não aparecem nos cartões; só na janela que abre ao tocar no produto.

## Link online (GitHub Pages)

Endereço: **https://jeanbreitenbach.github.io/GeoClima/**

Para ativar (uma vez só): no GitHub, abra o repositório → **Settings → Pages** →
em *Build and deployment* escolha **Deploy from a branch**, selecione o branch
`claude/digital-catalog-whatsapp-xv07ig` e a pasta **/ (root)** → **Save**.
Em 1–2 minutos o link fica no ar. Cada atualização enviada a esse branch atualiza o site.

## App Android (APK)

O projeto está em `android/`. O app abre o catálogo online (sempre com os preços atuais)
e, sem internet, mostra uma cópia que vem dentro do app. Os botões abrem o WhatsApp.

Gerar o APK (precisa do Android SDK):

```bash
cd android && ./gradlew assembleRelease
# APK em android/app/build/outputs/apk/release/app-release.apk
```

Para assinar com a mesma chave das versões anteriores, coloque `keystore.jks` e
`keystore.properties` dentro de `android/` (esses arquivos não vão para o GitHub).
Para lançar uma nova versão do app, aumente `versionCode` em `android/app/build.gradle`.
