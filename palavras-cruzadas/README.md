# Cruzadas do Saber

Palavras cruzadas educativas em português, para navegador. Funciona em qualquer computador ou celular e não precisa de instalação nem de internet.

## Como jogar
- **Computador:** dê dois cliques em `index.html`.
- **Celular:** abra a página publicada, ou sirva a pasta em qualquer hospedagem estática (GitHub Pages, por exemplo). Pelo menu do navegador dá para **instalar como aplicativo**, e aí funciona offline.

Clique ou toque numa casa e digite. Clicar de novo na mesma casa troca entre horizontal e vertical. No teclado físico também funcionam: setas, Enter/Tab (próxima palavra), Espaço (troca a direção) e Backspace. No celular aparece um teclado na tela.

## Conteúdo
- **1.104 palavras com dicas educativas** em 20 temas: casa, animais, alimentos, corpo humano e saúde, natureza, cores, países, Brasil, ciências, matemática, profissões, esportes e lazer, música e arte, transportes, língua portuguesa, tecnologia, história e cidadania, sentimentos, verbos e espaço.
- **Gerador de cruzadas:** cada nível monta uma grade com o máximo de cruzamentos. Os níveis da campanha são sempre os mesmos; o jogo livre sorteia uma grade nova a cada partida.

## Modos e progressão
- **Campanha:** 20 mundos e 123 níveis. O número de níveis de cada mundo depende do tamanho do tema, e as cruzadas crescem a cada nível. Cada nível dá de 1 a 3 estrelas, e completar 60% de um mundo libera o seguinte.
- **Sem repetição:** o jogo lembra as palavras que você já viu e monta as cruzadas com palavras inéditas. Só depois de ver todas é que ele repete, começando pelas vistas há mais tempo. Jogando um mundo inteiro, nenhuma palavra se repete.
- **Desafio diário:** uma cruzada por dia, igual para todo mundo, com prêmio extra.
- **Jogo livre:** você escolhe o tema (ou todos misturados) e o tamanho.
- **Missões diárias:** 3 missões novas por dia, como "acerte 30 palavras" ou "complete sem ajuda", que dão moedas e XP.
- **34 conquistas** com moedas para resgatar: cruzadas completas, palavras aprendidas, mundos completos, dias seguidos, jogar sem ajuda, compras na loja e outras.
- **Loja:** 9 temas visuais (Clássico, Noite, Oceano, Floresta, Pôr do sol, Doce, Jornal antigo, Galáxia, Neon), 16 avatares, pacotes de ajuda mais baratos que as ajudas avulsas e a proteção de sequência, que mantém os dias seguidos mesmo se você faltar um dia.
- **Nível do jogador e XP:** cada palavra vale 10 XP, mais um bônus por cruzada, com recompensa a cada nível novo.
- **Moedas** para ajudas: revelar uma letra (10), revelar a palavra (25) e verificar erros (5).
- **Meu dicionário:** cada palavra acertada sem revelar entra no dicionário com o significado. Dá para buscar e ver o progresso por tema.
- **Estatísticas** e **sequência de dias** jogando.
- **Configurações:** sons, mostrar letras erradas, pular casas preenchidas e teclado na tela. O tema escuro (Noite) é gratuito na loja.

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
