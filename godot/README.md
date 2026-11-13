# ILHA ZERO — versão Godot 4

Battle royale tático em 3ª/1ª pessoa feito no **Godot 4.3+** (GDScript). É inspirado nas mecânicas clássicas do gênero, mas o mapa, os nomes, a interface e o visual são próprios.

> ⚠️ **Estado:** o código passou por um analisador de sintaxe de GDScript, mas **ainda não foi executado dentro do Godot**. No primeiro teste podem aparecer erros pequenos (nome de propriedade, tipo). Se aparecer algum, copie a mensagem do painel "Saída/Depurador" e envie para correção.

## Como abrir
1. Baixe o **Godot 4.3** ou mais novo (versão padrão, não a ".NET") em https://godotengine.org/download.
2. Abra o Godot → **Importar** → selecione o arquivo `project.godot` desta pasta.
3. Espere o Godot importar o modelo do personagem (alguns segundos na primeira vez) e aperte **F5**.

Outra opção: coloque o executável do Godot nesta pasta e dê dois cliques em `jogar.bat`. Em PC antigo sem Vulkan (Celeron, Intel HD 2000/3000), use `jogar-pc-fraco.bat`, que roda em OpenGL.

Para gerar um `.exe`: **Projeto → Exportar → Adicionar → Windows Desktop**. Na primeira vez o Godot pede para baixar os "modelos de exportação".

## O que tem
- **Ilha de 1,8 km** gerada por semente, com praias, colinas, 8 cidades e casas que dá para entrar (porta, janelas, 2º andar com escada, telhado de duas águas), contêineres, árvores, rochas, arbustos e capim alto que balança com o vento.
- **Avião → queda livre → paraquedas**. O F salta e abre o paraquedas, e o W mergulha. O paraquedas abre sozinho perto do chão.
- **Zona azul** em 7 fases: o **círculo branco** mostra a próxima área segura, e o dano fora dela cresce a cada fase.
- **Zona vermelha:** bombardeio aleatório. Dentro de construção com teto você fica protegido.
- **Caixas de suprimentos** caindo de paraquedas com fumaça vermelha. Trazem armas exclusivas (Sniper Trovão, Metralhadora M-9), colete e capacete Nv3, kit médico e mira 8x.
- **Balística:** as balas têm velocidade e caem com a gravidade (um fuzil a 880 m/s, uma submetralhadora a 400 m/s). A luneta tem marcas de compensação de queda.
- **Hitboxes** de cabeça, tronco e pernas. Capacete e colete Nv1–3 reduzem o dano.
- **Armas:** pistola, SMG, 2 fuzis, escopeta (9 chumbos), DMR, sniper de ferrolho, e mais as 2 exclusivas da caixa.
- **Acessórios:** miras 2x/4x/8x, carregador estendido e compensador, encaixados automaticamente.
- **Cura e boost:** bandagem, kit de primeiros socorros, kit médico, energético e analgésico. O boost regenera vida e dá +6% de velocidade quando está alto.
- **Movimento:** correr, agachar, deitar, inclinar (Q/E), olhar livre (Alt), alternar 1ª e 3ª pessoa (V), tiro automático ou unitário (B).
- **Bots com IA** preenchem a partida. Eles saltam, pegam itens, fogem da zona, se curam e atiram com erro proporcional à habilidade.
- **Multiplayer na rede local:** um jogador cria a partida e os outros entram pelo IP, na porta **7777 UDP**. As vagas restantes viram bots.
- **HUD:** bússola com graus, vivos e abates, barra de vida e de boost, armas e munição, minimapa e mapa grande com as zonas, mira dinâmica, luneta, inventário (Tab), indicador de direção do dano e feed de abates.
- **Personagens realistas:** modelo humano com esqueleto e animações (parado, andando, correndo), 6 cores de uniforme e a arma na mão apontando para a mira.

## Gráficos automáticos
Ao abrir, o jogo lê a GPU, os núcleos, a RAM e se há Vulkan, e escolhe um nível:

| Nível | O que muda |
|---|---|
| Batata | resolução a 55% (FSR), sem sombras, sem capim, menos árvores, neblina próxima |
| Baixo | resolução 75%, sombras curtas, capim num raio de 22 m |
| Médio | resolução 90% (FSR 2), sombras, SSAO, bloom, capim em 36 m |
| Alto | resolução nativa, TAA, neblina volumétrica, capim em 50 m |
| Ultra | **iluminação global em tempo real (SDFGI)**, reflexos (SSR), SSIL, MSAA 2x, capim em 65 m |
| Extremo | Ultra + MSAA 4x + **supersampling** (renderiza acima da tela, até 8K) |

Durante o jogo, a **resolução dinâmica** mantém o FPS alvo. Se nem assim o FPS se sustenta, o jogo **desce um nível**; se sobra desempenho, **sobe um**. Para fixar um nível, use **Esc → Gráficos e controles**.

O Godot 4 não tem ray tracing por hardware. O nível Extremo usa SDFGI e SSR, que são as técnicas de iluminação global e reflexo do próprio motor.

## Controles
WASD mover · Shift correr · Espaço pular · C agachar · Z deitar · Q/E inclinar · Alt olhar livre · V 1ª/3ª pessoa
Mouse atirar · Botão direito mirar · R recarregar · F pegar / saltar / paraquedas · 1/2/3 armas · X guardar · B modo de tiro
4 bandagem · 5 primeiros socorros · 6 kit médico · 7 energético · 8 analgésico · Tab inventário · M mapa · Esc pausa

## Estrutura
```
scripts/game.gd           dados (armas, itens), controles, configurações, detecção de hardware
scripts/quality.gd        níveis gráficos e ajuste automático por FPS
scripts/world.gd          ilha, cidades, casas, vegetação, capim, céu, água, colisões
scripts/match.gd          avião, zonas, caixas, loot, balas, dano, mortes, vitória, rede
scripts/soldier.gd        soldado: movimento, câmera, armas, cura, animação, IA dos bots
scripts/hud.gd            interface
scripts/main.gd           menu, sala de espera (LAN), controles do jogador
scripts/weapon_models.gd  modelos de armas e itens
shaders/                  terreno, capim, céu, água, parede da zona
assets/characters/        modelo do soldado (Mixamo/three.js)
```

## Limitações
- Sem veículos, granadas, nado completo, mochila com limite de peso e esquadrões.
- O modelo de personagem não tem animações de agachar, deitar, pular, morrer ou mirar. Essas poses são aproximadas girando o corpo.
- A rede local confia em cada jogador para o próprio movimento e para a detecção de acerto. O host valida o dano máximo por arma e a distância de coleta. Não há proteção contra trapaça para jogar pela internet.

## Créditos
- Modelo do soldado: personagem "Vanguard" do Mixamo (Adobe), distribuído nos exemplos do three.js. O uso em jogos é permitido; não redistribua o arquivo separado do jogo.
- Godot Engine (licença MIT).
