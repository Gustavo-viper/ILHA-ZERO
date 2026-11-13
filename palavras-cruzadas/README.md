# Cruzadas do Saber

Palavras cruzadas educativas em português, para navegador. Funciona em qualquer computador ou celular e não precisa de instalação nem de internet.

## Como jogar
- **Computador:** dê dois cliques em `index.html`.
- **Celular:** abra a página publicada, ou sirva a pasta em qualquer hospedagem estática (GitHub Pages, por exemplo). Pelo menu do navegador dá para **instalar como aplicativo**, e aí funciona offline.

Clique ou toque numa casa e digite. Clicar de novo na mesma casa troca entre horizontal e vertical. No teclado físico também funcionam: setas, Enter/Tab (próxima palavra), Espaço (troca a direção) e Backspace. No celular aparece um teclado na tela.

## Conteúdo
- **1.089 palavras com dicas educativas** em 20 temas: casa, animais, alimentos, corpo humano e saúde, natureza, cores, países, Brasil, ciências, matemática, profissões, esportes e lazer, música e arte, transportes, língua portuguesa, tecnologia, história e cidadania, sentimentos, verbos e espaço.
- **Gerador de cruzadas:** cada nível monta uma grade com o máximo de cruzamentos. Os níveis da campanha são sempre os mesmos; o jogo livre sorteia uma grade nova a cada partida.

## Modos e progressão
- **Campanha:** 20 mundos com 10 níveis cada (200 níveis). As cruzadas crescem de 7 para 16 palavras. Cada nível dá de 1 a 3 estrelas, e completar 6 níveis libera o mundo seguinte.
- **Desafio diário:** uma cruzada por dia, igual para todo mundo, com prêmio extra.
- **Jogo livre:** você escolhe o tema (ou todos misturados) e o tamanho.
- **Missões diárias:** 3 missões novas por dia, como "acerte 30 palavras" ou "complete sem ajuda", que dão moedas e XP.
- **30 conquistas**, como cruzadas completas, palavras aprendidas, mundos completos, dias seguidos e jogar sem ajuda.
- **Nível do jogador e XP:** cada palavra vale 10 XP, mais um bônus por cruzada, com recompensa a cada nível novo.
- **Moedas** para ajudas: revelar uma letra (10), revelar a palavra (25) e verificar erros (5).
- **Meu dicionário:** cada palavra acertada sem revelar entra no dicionário com o significado. Dá para buscar e ver o progresso por tema.
- **Estatísticas** e **sequência de dias** jogando.
- **Configurações:** sons, tema escuro, mostrar letras erradas, pular casas preenchidas e teclado na tela.

O progresso fica salvo no próprio navegador (localStorage).

## Estrutura
```
index.html          interface e estilos
js/palavras.js      banco de palavras e dicas (fácil de ampliar: uma linha "PALAVRA|dica")
js/gerador.js       gerador de cruzadas
js/jogo.js          telas, jogo, progresso, missões e conquistas
sw.js, manifest     funcionamento offline e instalação como aplicativo
```

Para acrescentar palavras, adicione linhas `PALAVRA|dica` no tema desejado em `js/palavras.js`. Acentos são permitidos: na grade eles somem e o Ç vira C.
