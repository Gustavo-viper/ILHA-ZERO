# Oficina Turbo 🔧🏁

Jogo de **oficina mecânica e tunagem de carros** que roda no navegador e funciona **offline** (PWA).
Sem dependências, sem build: é só HTML, CSS e JavaScript.

## Como se joga

- **Oficina**: cada dia chegam clientes com reclamações (“chiado ao frear”, “não pega de manhã”…).
  Inspecione as peças (10 min cada), troque as que estão ruins acertando o aperto dos parafusos e entregue o carro.
  O cliente paga peça + mão de obra das peças gastas; trocar peça boa ou deixar defeito queima sua fama.
  A oficina fecha às 18:00 e cobra aluguel todo dia.
- **Garagem**: até 4 carros seus. Conserte, escolha o carro ativo ou venda com lucro.
- **Tuning**: preparação interna, turbo (3 tamanhos), injeção programável, câmbio, pneus, suspensão, alívio de peso, nitro, aerofólio e pintura.
  No **dinamômetro** você vê a curva de potência e torque e, com a injeção programável, ajusta pressão do turbo,
  avanço de ignição e mistura. Exagerou? **Detonação** estraga o motor.
- **Arrancada**: ¼ de milha contra 7 rivais. Segure o acelerador antes da luz verde, largue no giro certo,
  troque de marcha na luz verde do conta-giros e solte o nitro.
  Teclado: **espaço/↑** acelera, **→/Enter** troca a marcha, **N** nitro.
- **Loja**: scanner e elevador (diagnóstico rápido), chave de impacto, vagas extras, cabine de pintura e o ferro-velho com carros baratos para reformar.

O progresso é salvo automaticamente no aparelho (localStorage).

## Rodar localmente

Qualquer servidor estático serve (o service worker não funciona abrindo o arquivo direto):

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

## Publicar e instalar

Publique a pasta em qualquer hospedagem estática com HTTPS (GitHub Pages, Netlify, Vercel…).
No GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / root*.
Depois abra no celular e use “Adicionar à tela inicial”. Após a primeira visita, o jogo funciona sem internet.

Ao alterar arquivos, aumente `VERSAO` em `sw.js` para os aparelhos baixarem a versão nova.

## Estrutura

| Arquivo | O que faz |
|---|---|
| `index.html`, `css/style.css` | Página e visual |
| `js/data.js` | Peças, modelos, upgrades, equipamentos e rivais |
| `js/fisica.js` | Curva do motor, turbo, mapa da injeção e física da arrancada |
| `js/estado.js` | Save, economia, clientes, ferro-velho |
| `js/telas.js` | Telas da oficina, garagem, tuning/dinamômetro, rachas e loja |
| `js/corrida.js` | Tela da arrancada |
| `js/desenho.js` | Desenho dos carros em canvas |
| `js/som.js` | Sons sintetizados (Web Audio) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA offline |
