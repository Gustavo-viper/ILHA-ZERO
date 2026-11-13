# ILHA ZERO — Battle Royale no navegador (protótipo)

Battle royale de mundo aberto em 3D que roda direto no navegador, sem instalar nada.
Ilha de 1,6 km × 1,6 km, 30 jogadores por partida (as vagas vazias viram bots), avião,
salto de paraquedas, armas e itens espalhados pelo mapa, e uma zona que encolhe.

## Como testar

**Jeito mais fácil:** instale o [Node.js](https://nodejs.org) (versão LTS) e dê dois cliques em `iniciar-windows.bat` (ou rode `./iniciar-linux-mac.sh`). O jogo abre no navegador em `http://localhost:8080`, com os modos online e offline.

### Opção 1: offline contra bots (só abrir)
Sirva a pasta `public/` em qualquer servidor estático e abra no navegador, por exemplo:

```bash
cd battle-royale/public
python3 -m http.server 8000      # abra http://localhost:8000
```

> Abrir o `index.html` com duplo clique (`file://`) não funciona, porque os navegadores bloqueiam módulos JS nesse modo.

### Opção 2: multiplayer de verdade (servidor Node)
```bash
cd battle-royale
npm install
npm start                        # abra http://localhost:8080
```
O terminal mostra também o endereço da rede local (ex.: `http://192.168.0.10:8080`), então outros
PCs da mesma rede podem entrar na mesma partida. Clique em **JOGAR ONLINE**.

Variáveis opcionais: `PORT` (8080), `PLAYERS` (30 por partida), `LOBBY` (25 s de aquecimento), `SEED` (semente do mapa).

## Controles
| Tecla | Ação |
|---|---|
| WASD / Shift / Espaço / C | mover / correr / pular / agachar |
| Mouse · botão direito | atirar · mirar (ADS; a sniper usa luneta 4x) |
| E | pegar item |
| R | recarregar |
| 1 / 2 | trocar de arma |
| 3 / 4 | bandagem / kit médico |
| F | saltar do avião / abrir o paraquedas |
| M | mapa grande |
| Esc | menu de gráficos e controles |

## Gráficos automáticos (do Celeron com DDR3 até 8K)
Ao iniciar, o jogo lê a GPU (WebGL), os núcleos da CPU, a RAM e a tela, e escolhe um nível:

| Nível | Pensado para | O que muda |
|---|---|---|
| **Batata** | Celeron/Pentium, Intel HD antiga, 2 GB de RAM | render a 35–60% da resolução, sem sombras, materiais Lambert, 25% da vegetação, neblina próxima |
| **Baixo** | Intel HD/UHD dos últimos anos, dual-core | 40–80% da resolução, sem sombras, mais vegetação |
| **Médio** | Iris Xe, GTX antigas, APUs Ryzen | PBR, céu atmosférico, sombras 1024 |
| **Alto** | GTX 1060/1660, RX 580, Apple M1 | sombras 2048, bloom, supersampling até 1,25x |
| **Ultra** | RTX 20xx/30xx, RX 6000, Apple M2+ | sombras 4096, GTAO (oclusão de ambiente), SMAA, reflexo do céu |
| **Extremo** | RTX 3070+/40xx/50xx, RX 7800+ | Ultra + reflexos SSR (ray-marching em tela) + supersampling até **7680×4320 (8K)** |

Durante o jogo, um **ajuste automático** fica medindo o FPS:
- **resolução dinâmica**: abaixa/aumenta a resolução interna para manter o FPS alvo;
- se mesmo na resolução mínima o FPS não se sustenta, o jogo **desce um nível**; se sobra desempenho, ele **sobe um nível** (e nunca volta para um nível que já falhou).

Tudo pode ser fixado manualmente em **Esc → Gráficos**. O canto superior esquerdo mostra o FPS, a resolução real de render (indica 4K/8K), as draw calls e os efeitos ativos.

**Sobre ray tracing:** navegadores ainda não dão acesso ao ray tracing por hardware das placas RTX (o WebGL não tem essa API). O nível Extremo usa o que o navegador permite: reflexos calculados por ray-marching em espaço de tela (SSR), GTAO e iluminação baseada no céu.

## Arquitetura
```
battle-royale/
├── server.js                 servidor HTTP + WebSocket (autoritativo, 30 ticks/s, snapshots a 15/s)
└── public/
    ├── index.html            menu, HUD, configurações
    ├── js/main.js            cliente: controles, câmera 3ª pessoa, tiro, HUD, minimapa, áudio sintetizado
    ├── js/scene.js           renderização (Three.js), materiais por nível, pós-processamento
    ├── js/quality.js         detecção de hardware, níveis e ajuste automático
    ├── js/net.js             transporte online (WebSocket) e offline (simulação local)
    ├── js/shared/world.js    ilha procedural determinística, casas com interior, colisão e raycast
    ├── js/shared/sim.js      regras da partida: loot, armas, dano, zona, avião, IA dos bots
    └── vendor/three/         Three.js r170 (MIT), incluído para funcionar offline
```
O mesmo `sim.js` roda no servidor (multiplayer) e dentro do navegador (modo offline), então as regras são idênticas nos dois modos.
O servidor valida tiros (cadência, munição, alcance e linha de visão), coleta de itens e velocidade de movimento.

## Personagens realistas
A partir do nível **Baixo**, os jogadores e bots usam um modelo humano 3D com esqueleto de 49 ossos e animações
de parado, andando e correndo, misturadas suavemente conforme a velocidade. A coluna e a cabeça acompanham a mira,
e a arma presa na mão aponta para onde o jogador mira. Há 6 variações de cor de uniforme. No nível **Batata** o
jogo continua usando o personagem simples feito por código, que é bem mais leve.

Personagens longe da câmera atualizam a animação com menos frequência, para economizar CPU.

## Créditos
- Modelo do soldado (`public/models/soldier.glb`): personagem "Vanguard" do Mixamo (Adobe), distribuído nos exemplos do [three.js](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf). O Mixamo permite usar seus personagens e animações em jogos; não redistribua o arquivo separado do jogo.
- [three.js](https://threejs.org) r170 (licença MIT).

## Limitações deste protótipo
- Um único modelo humano (com variações de cor); cenário, armas e texturas são gerados por código.
- O modelo não tem animações de agachar, pular, morrer ou mirar: essas poses são aproximadas girando ossos.
- Sem veículos, granadas, esquadrões nem chat de voz.
- Sem compensação de lag: o servidor confia na detecção de acerto do atirador (com validação básica).
- Sem controles de toque para celular.
