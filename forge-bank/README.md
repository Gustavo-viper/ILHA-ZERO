# Forge Bank

Protótipo de app de banco digital da Forge Studios, feito para rodar no navegador (pensado para celular, funciona no computador).

> **Tudo é simulado.** Os dados ficam salvos só no navegador (localStorage) e nenhum dinheiro real é movimentado. Não use dados bancários reais.

## Como rodar

Instale o [Node.js](https://nodejs.org) (LTS) e:

- **Windows:** dê dois cliques em `iniciar-windows.bat`
- **Linux/Mac:** rode `./iniciar-linux-mac.sh`
- ou, no terminal: `node server.js`

Depois abra `http://localhost:8090`. Não há dependências para instalar.

Como o app é só HTML/CSS/JS, também dá para publicar a pasta `public/` em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel).

## Identidade visual

Usa o logo da Forge Studios e a paleta da marca: fundo quase preto arroxeado, roxo neon (`#a63dff` / `#e48cff`) e prata. As cores ficam nas variáveis do topo de `public/styles.css`.

## O que tem

| Área | Funções |
|---|---|
| Abertura de conta | Nome, CPF (com validação dos dígitos), e-mail, celular e PIN de 6 dígitos. Ganha R$ 1.000 de demonstração. |
| Login | Teclado de PIN, bloqueio após 3 erros, bloqueio automático após 5 min sem uso. |
| Início | Saldo (com opção de esconder), atalhos, resumo do cartão e da caixinha, últimas movimentações. |
| Pix | Enviar (detecta CPF, CNPJ, celular, e-mail ou chave aleatória), receber com QR ilustrativo, contatos recentes, gerenciar chaves. |
| Pagar | Boleto por linha digitável (47 ou 48 números); lê o valor do código. Botão para gerar boleto de teste. |
| Depositar | Adiciona saldo de demonstração. |
| Caixinha | Guardar e resgatar, rendimento diário composto (~15,7% a.a. simulado), botão para simular 30 dias. |
| Cartão | Cartão virtual (número com Luhn válido), ver dados com PIN, bloquear/desbloquear, simular compras, pagar fatura. |
| Extrato | Filtro por entradas/saídas, agrupado por dia, totais. |
| Perfil | Dados da conta, alterar PIN, bloquear app, encerrar conta. |

Operações que tiram dinheiro da conta pedem o PIN. Valores são guardados em centavos (inteiros).

## Estrutura

```
forge-bank/
├── server.js            servidor estático sem dependências (porta 8090, ou PORT)
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js           todo o app: estado, telas e roteamento por hash (#/pix, #/cartao...)
    ├── logo.jpg         logo da Forge Studios (tela de entrada)
    ├── icon-192.png / icon-512.png   emblema "F" (favicon, ícone do app e do cartão)
    └── manifest.webmanifest   permite "Adicionar à tela inicial" no celular
```

## Para virar um banco de verdade

Este protótipo é só a interface. Um banco real exige backend com autenticação forte, banco de dados com contabilidade em partidas dobradas, integração com o Pix (SPI/DICT do Banco Central) via instituição autorizada ou parceiro BaaS, emissão de cartão via processadora, KYC/antifraude e adequação à LGPD e às regras do Banco Central.
