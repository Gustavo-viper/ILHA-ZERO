# Oficina Turbo 🔧🏁

Jogo de **oficina mecânica e tunagem de carros** que roda no navegador e funciona **offline** (PWA).
Sem build: é só HTML, CSS e JavaScript, com o [Three.js](https://threejs.org) (licença MIT) incluído em `vendor/three/` para funcionar sem internet.

## Como se joga

- **Oficina 3D**: cada dia chegam clientes com reclamações (“chiado ao frear”, “não pega de manhã”…).
  O carro sobe no elevador com o capô aberto: gire a câmera, toque nas peças para inspecionar (10 min cada),
  solte os parafusos um a um, tire a peça, monte a nova e aperte cada parafuso no torque certo.
  Algumas peças só saem depois de outras (pneu → pastilha → disco; filtro de ar → velas; escapamento → embreagem).
  O cliente paga peça + mão de obra das peças gastas; trocar peça boa ou deixar defeito queima sua fama.
  A oficina fecha às 18:00 e cobra aluguel todo dia.
- **Garagem**: até 4 carros seus. Desmonte e conserte no elevador 3D, escolha o carro ativo ou venda com lucro.
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
| `js/carro3d.js` | Carro 3D com peças, parafusos e ordem de desmontagem; fotos 3D das listas |
| `js/oficina3d.js` | Oficina 3D: elevador, câmera orbital, desmontar/montar e torque |
| `js/desenho.js` | Desenho 2D dos carros (arrancada) |
| `js/som.js` | Sons sintetizados (Web Audio) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA offline |
