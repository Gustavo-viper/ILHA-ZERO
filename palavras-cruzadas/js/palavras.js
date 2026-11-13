// Banco de palavras com dicas educativas. Formato de cada linha: PALAVRA|dica
// As palavras podem ter acento: na grade elas aparecem sem acento (Ç vira C).
window.CATEGORIAS = [
{ id: 'casa', nome: 'Casa e objetos', icone: '🏠', cor: '#e08e45', lista: `
CADEIRA|Móvel para sentar que tem encosto
MESA|Móvel com tampo usado para as refeições
SOFÁ|Assento estofado para várias pessoas
CAMA|Móvel onde se dorme
ARMÁRIO|Móvel para guardar roupas ou objetos
GELADEIRA|Eletrodoméstico que conserva os alimentos frios
FOGÃO|Aparelho usado para cozinhar
TELEVISÃO|Aparelho que exibe programas e filmes
TAPETE|Tecido que cobre e enfeita o chão
CORTINA|Tecido que cobre a janela
JANELA|Abertura na parede para entrar luz e ar
PORTA|Abertura por onde se entra e sai de um cômodo
TELHADO|Cobertura da casa
ESCADA|Conjunto de degraus para subir e descer
CHAVE|Objeto que abre a fechadura
TRAVESSEIRO|Almofada para apoiar a cabeça ao dormir
COBERTOR|Manta grossa que aquece na cama
LENÇOL|Tecido que cobre o colchão
TOALHA|Tecido usado para se enxugar
PENTE|Objeto com dentes para arrumar o cabelo
ESCOVA|Objeto com cerdas para limpar ou pentear
SABONETE|Usado com água para lavar o corpo
XÍCARA|Recipiente com asa para café ou chá
COPO|Recipiente usado para beber
PRATO|Recipiente raso onde se serve a comida
GARFO|Talher com dentes
COLHER|Talher em forma de pequena concha
FACA|Talher com lâmina para cortar
PANELA|Recipiente usado para cozinhar
CHALEIRA|Recipiente para ferver água
VASSOURA|Objeto usado para varrer o chão
BALDE|Recipiente com alça para carregar água
LÂMPADA|Objeto que ilumina quando ligado à eletricidade
TOMADA|Ponto na parede onde se ligam aparelhos elétricos
RELÓGIO|Objeto que marca as horas
CALENDÁRIO|Tabela com os dias e os meses do ano
TESOURA|Instrumento de duas lâminas para cortar
AGULHA|Objeto fino e pontudo usado para costurar
SOMBRINHA|Pequeno guarda-chuva
MOCHILA|Bolsa carregada nas costas
CANETA|Objeto para escrever com tinta
LÁPIS|Objeto de escrever que tem grafite
BORRACHA|Objeto que apaga o que foi escrito a lápis
CADERNO|Conjunto de folhas para anotações
LIVRO|Conjunto de páginas encadernadas com um texto
ESTANTE|Móvel com prateleiras para livros
GAVETA|Compartimento que desliza para dentro de um móvel
VARAL|Corda onde se estende a roupa para secar
MARTELO|Ferramenta usada para bater pregos
PREGO|Haste de metal pontuda fixada com martelo
PARAFUSO|Peça com rosca fixada com chave de fenda
ALICATE|Ferramenta para segurar e cortar fios
SERROTE|Ferramenta dentada para cortar madeira
LANTERNA|Luz portátil que funciona a pilha
VELA|Cilindro de cera com pavio que ilumina
FÓSFORO|Palito que acende fogo ao ser riscado
CAMPAINHA|Botão que toca para avisar que alguém chegou
VENTILADOR|Aparelho que movimenta o ar com hélices
TELEFONE|Aparelho para falar com alguém à distância
ALMOFADA|Pequeno travesseiro decorativo
QUADRO|Pintura ou imagem pendurada na parede
JARDIM|Área da casa com plantas e flores
QUINTAL|Área livre nos fundos da casa
COZINHA|Cômodo onde se preparam as refeições
BANHEIRO|Cômodo onde se toma banho
QUARTO|Cômodo onde se dorme
SALA|Cômodo de estar e de receber visitas
GARAGEM|Lugar onde se guarda o carro
CHUVEIRO|Aparelho de onde sai a água do banho
TORNEIRA|Peça que libera a água da pia
COLCHÃO|Parte macia da cama onde se deita
` },
{ id: 'animais', nome: 'Animais', icone: '🐾', cor: '#c97b2c', lista: `
GATO|Felino doméstico que mia
CACHORRO|Conhecido como o melhor amigo do ser humano, late
CAVALO|Animal usado na montaria que relincha
VACA|Fêmea do boi que produz leite
OVELHA|Animal que fornece lã
CABRA|Animal com chifres que bala, fêmea do bode
PORCO|Animal criado no chiqueiro que grunhe
GALINHA|Ave doméstica que bota ovos
PATO|Ave aquática de bico achatado que grasna
COELHO|Mamífero de orelhas compridas que salta
LEÃO|Felino conhecido como rei da selva
TIGRE|Grande felino listrado da Ásia
ONÇA|Maior felino das Américas, de pelagem pintada
ELEFANTE|Maior animal terrestre, tem tromba
GIRAFA|Animal de pescoço mais longo
ZEBRA|Equino africano de listras pretas e brancas
MACACO|Primata ágil que vive nas árvores
GORILA|Maior dos primatas
URSO|Mamífero grande que hiberna em regiões frias
LOBO|Canídeo selvagem que uiva e vive em alcateias
RAPOSA|Canídeo de cauda peluda, símbolo de esperteza
JACARÉ|Réptil de focinho largo dos rios e pântanos do Brasil
CROCODILO|Réptil grande de focinho fino da África e da Ásia
TARTARUGA|Réptil protegido por um casco
COBRA|Réptil sem patas que rasteja
LAGARTO|Réptil de quatro patas e cauda longa
SAPO|Anfíbio de pele rugosa que coaxa
GOLFINHO|Mamífero marinho inteligente que vive em grupos
BALEIA|Maior animal do planeta, vive no mar
TUBARÃO|Peixe predador com várias fileiras de dentes
POLVO|Molusco marinho com oito tentáculos
LULA|Molusco marinho que solta tinta para fugir
CARANGUEJO|Crustáceo que anda de lado
CAMARÃO|Pequeno crustáceo muito usado na culinária
PINGUIM|Ave que não voa e nada em águas geladas
ÁGUIA|Ave de rapina de visão muito aguçada
CORUJA|Ave noturna de olhos grandes
PAPAGAIO|Ave colorida que imita a fala humana
TUCANO|Ave de bico enorme e colorido
ARARA|Grande ave colorida da família dos papagaios
COLIBRI|Ave pequena que bate as asas muito rápido para sugar néctar
POMBO|Ave muito comum nas praças das cidades
PARDAL|Pequeno pássaro marrom comum nas cidades
URUBU|Ave que se alimenta de animais mortos
AVESTRUZ|Maior ave do mundo, não voa
PAVÃO|Ave que abre a cauda colorida em leque
FORMIGA|Inseto que vive em colônias e carrega folhas
ABELHA|Inseto que produz mel
BORBOLETA|Inseto de asas coloridas que antes foi lagarta
MOSQUITO|Inseto que pica e pode transmitir doenças
ARANHA|Animal de oito patas que tece teias
ESCORPIÃO|Aracnídeo com ferrão venenoso na cauda
JOANINHA|Pequeno besouro vermelho com pintas pretas
GRILO|Inseto que canta à noite esfregando as asas
MINHOCA|Animal que vive na terra e a deixa fértil
CARACOL|Molusco lento que carrega uma concha
MORCEGO|Único mamífero capaz de voar
CANGURU|Marsupial australiano que pula e leva o filhote na bolsa
COALA|Marsupial australiano que come folhas de eucalipto
PREGUIÇA|Mamífero lento que vive pendurado nas árvores
TAMANDUÁ|Mamífero de focinho longo que come formigas
CAPIVARA|Maior roedor do mundo
TATU|Mamífero com carapaça que se enrola como bola
CAMELO|Animal do deserto que tem duas corcovas
DROMEDÁRIO|Parente do camelo que tem uma só corcova
HIPOPÓTAMO|Grande mamífero africano que vive nos rios
RINOCERONTE|Mamífero de pele grossa com chifre no focinho
ESQUILO|Roedor de cauda peluda que guarda nozes
RATO|Pequeno roedor de cauda longa
HAMSTER|Roedor de estimação que guarda comida nas bochechas
FOCA|Mamífero marinho de regiões frias
LEOPARDO|Felino de manchas em forma de roseta
GUEPARDO|Animal terrestre mais rápido do mundo
PANDA|Urso preto e branco que come bambu
PELICANO|Ave aquática com uma bolsa no bico
CISNE|Ave aquática de pescoço longo e elegante
FLAMINGO|Ave rosada que costuma ficar em uma perna só
CORVO|Ave preta considerada muito inteligente
GAIVOTA|Ave marinha comum nas praias
SARDINHA|Peixe pequeno muito vendido em lata
SALMÃO|Peixe de carne rosada que sobe os rios para desovar
PIRANHA|Peixe de dentes afiados dos rios da América do Sul
MEDUSA|Outro nome da água-viva
OSTRA|Molusco que pode produzir pérolas
LAGOSTA|Crustáceo marinho de antenas longas
CAMALEÃO|Réptil que muda de cor
IGUANA|Réptil verde com crista nas costas
SALAMANDRA|Anfíbio de corpo alongado e com cauda
LHAMA|Animal dos Andes usado para carga e lã
ALCE|Grande cervo de chifres largos do hemisfério norte
VEADO|Mamífero ágil cujo macho tem galhada
JAVALI|Porco selvagem com presas
TOUPEIRA|Mamífero que cava túneis e enxerga pouco
OURIÇO|Pequeno mamífero coberto de espinhos
GAMBÁ|Marsupial brasileiro que solta um cheiro forte quando ameaçado
` },
{ id: 'alimentos', nome: 'Frutas e alimentos', icone: '🍎', cor: '#d64545', lista: `
BANANA|Fruta amarela rica em potássio
MAÇÃ|Fruta vermelha ou verde de polpa crocante
LARANJA|Fruta cítrica muito usada em sucos
LIMÃO|Fruta cítrica azeda usada para fazer limonada
UVA|Fruta em cachos usada para fazer vinho e passas
MELANCIA|Fruta grande, verde por fora e vermelha por dentro
MELÃO|Fruta de casca grossa e polpa doce e suculenta
ABACAXI|Fruta com coroa de folhas e casca espinhosa
MANGA|Fruta tropical de caroço grande e polpa amarela
MAMÃO|Fruta alaranjada que ajuda o funcionamento do intestino
GOIABA|Fruta de polpa rosada rica em vitamina C
MORANGO|Fruta vermelha com as sementes por fora
CEREJA|Pequena fruta vermelha que enfeita bolos
PERA|Fruta de formato parecido com uma gota
PÊSSEGO|Fruta de casca aveludada
AMEIXA|Fruta roxa também consumida seca
KIWI|Fruta marrom e peluda por fora, verde por dentro
COCO|Fruto de casca dura que tem água dentro
AÇAÍ|Fruto roxo da Amazônia consumido como creme gelado
CAJU|Fruto cuja castanha fica do lado de fora
ACEROLA|Pequena fruta vermelha riquíssima em vitamina C
MARACUJÁ|Fruta azeda usada em sucos e famosa por acalmar
JABUTICABA|Fruta preta que nasce grudada no tronco da árvore
PITANGA|Pequena fruta vermelha em gomos, nativa do Brasil
GRAVIOLA|Fruta verde de casca espinhosa e polpa branca
CUPUAÇU|Fruta amazônica parente do cacau
TOMATE|Fruto vermelho usado em molhos e saladas
ABACATE|Fruta verde e cremosa rica em gordura boa
FIGO|Fruta roxa cheia de sementinhas por dentro
FRAMBOESA|Pequena fruta vermelha formada por bolinhas
ARROZ|Grão que forma com o feijão o prato típico brasileiro
FEIJÃO|Grão rico em ferro, parceiro do arroz
MILHO|Grão amarelo usado na pamonha e na pipoca
TRIGO|Cereal usado para fazer farinha e pão
AVEIA|Cereal rico em fibras comum no café da manhã
MANDIOCA|Raiz também chamada de aipim ou macaxeira
BATATA|Tubérculo usado em purês e fritas
CENOURA|Raiz alaranjada rica em vitamina A
BETERRABA|Raiz roxa de sabor adocicado
ALFACE|Folha verde básica das saladas
COUVE|Folha verde servida refogada com a feijoada
BRÓCOLIS|Hortaliça verde em forma de pequenas árvores
CEBOLA|Bulbo que faz chorar ao ser cortado
ALHO|Bulbo de sabor forte usado como tempero
PEPINO|Legume verde e fresco usado em saladas e conservas
ABÓBORA|Legume grande e alaranjado
BERINJELA|Legume de casca roxa brilhante
PIMENTÃO|Legume verde, vermelho ou amarelo
ERVILHA|Pequeno grão verde que nasce em vagens
LENTILHA|Grão achatado tradicional na ceia de Ano-Novo
PÃO|Alimento assado feito de farinha e fermento
QUEIJO|Alimento feito com o leite coalhado
MANTEIGA|Gordura feita com a nata do leite
IOGURTE|Leite fermentado por bactérias benéficas
LEITE|Bebida branca produzida pelas vacas
OVO|Alimento posto pela galinha
MEL|Alimento doce produzido pelas abelhas
AÇÚCAR|Substância doce extraída da cana ou da beterraba
SAL|Tempero branco extraído principalmente do mar
CHOCOLATE|Doce feito a partir do cacau
SORVETE|Sobremesa gelada e cremosa
BOLO|Doce assado que ganha velas nos aniversários
BRIGADEIRO|Docinho de chocolate típico das festas brasileiras
PAMONHA|Iguaria de milho verde cozida na palha
TAPIOCA|Alimento feito com a goma da mandioca
FEIJOADA|Prato brasileiro de feijão preto com carnes
COXINHA|Salgado em formato de gota recheado de frango
PIPOCA|Milho que estoura com o calor
MACARRÃO|Massa de origem italiana com vários formatos
PIZZA|Massa redonda assada com cobertura, de origem italiana
SOPA|Prato líquido e quente
SALADA|Prato frio de folhas e legumes
CAFÉ|Bebida escura e estimulante feita de grãos torrados
CHÁ|Bebida feita com folhas em infusão
SUCO|Bebida feita espremendo frutas
CANELA|Especiaria tirada da casca de uma árvore
ORÉGANO|Erva seca usada para temperar a pizza
GENGIBRE|Raiz de sabor picante usada em chás
AZEITE|Óleo extraído da azeitona
VINAGRE|Líquido ácido usado para temperar saladas
` },
{ id: 'corpo', nome: 'Corpo humano e saúde', icone: '🫀', cor: '#d9577a', lista: `
CORAÇÃO|Órgão que bombeia o sangue pelo corpo
PULMÃO|Órgão da respiração
CÉREBRO|Órgão que comanda o corpo e o pensamento
FÍGADO|Maior glândula do corpo, filtra substâncias do sangue
ESTÔMAGO|Órgão onde a digestão continua com a ajuda de ácido
RIM|Órgão que filtra o sangue e produz a urina
INTESTINO|Tubo longo onde os nutrientes são absorvidos
PELE|Maior órgão do corpo humano
OSSO|Parte dura que forma o esqueleto
MÚSCULO|Tecido que permite o movimento do corpo
SANGUE|Líquido vermelho que circula pelos vasos
VEIA|Vaso que leva o sangue de volta ao coração
ARTÉRIA|Vaso que leva o sangue do coração para o corpo
NERVO|Fibra que transmite os sinais do cérebro
CRÂNIO|Conjunto de ossos que protege o cérebro
COLUNA|Eixo formado por vértebras que sustenta o corpo
COSTELA|Osso curvo que protege o tórax
JOELHO|Articulação no meio da perna
COTOVELO|Articulação no meio do braço
TORNOZELO|Articulação entre a perna e o pé
OMBRO|Parte onde o braço se liga ao tronco
PESCOÇO|Parte que liga a cabeça ao tronco
CABELO|Fios que crescem na cabeça
UNHA|Placa dura na ponta dos dedos
DENTE|Usado para mastigar os alimentos
LÍNGUA|Órgão do paladar que fica dentro da boca
NARIZ|Órgão do olfato
ORELHA|Parte externa do órgão da audição
OLHO|Órgão da visão
PÁLPEBRA|Pele que cobre e protege o olho
SOBRANCELHA|Fileira de pelos acima dos olhos
QUEIXO|Parte inferior do rosto
BOCHECHA|Parte lateral do rosto
TESTA|Parte do rosto acima dos olhos
UMBIGO|Cicatriz na barriga deixada pelo cordão umbilical
PULSO|Junção da mão com o braço, onde se sentem os batimentos
POLEGAR|Dedo mais grosso da mão
CALCANHAR|Parte de trás do pé
SALIVA|Líquido da boca que inicia a digestão
SUOR|Líquido que a pele libera para esfriar o corpo
VACINA|Proteção que ensina o corpo a combater doenças
VITAMINA|Nutriente essencial necessário em pequenas quantidades
PROTEÍNA|Nutriente que constrói e repara os músculos
FEBRE|Aumento da temperatura do corpo
GRIPE|Doença causada por vírus, com tosse e febre
ALERGIA|Reação exagerada do corpo a uma substância
TOSSE|Expulsão forçada de ar pela garganta
HIGIENE|Cuidados de limpeza que protegem a saúde
EXERCÍCIO|Atividade física que mantém o corpo saudável
SONO|Descanso diário em que o corpo se recupera
HOSPITAL|Lugar onde os doentes recebem tratamento
REMÉDIO|Substância usada para tratar doenças
CURATIVO|Proteção colocada sobre um machucado
TERMÔMETRO|Instrumento que mede a temperatura do corpo
ESQUELETO|Conjunto de todos os ossos do corpo
DIGESTÃO|Processo que transforma os alimentos em nutrientes
RESPIRAÇÃO|Troca de gases entre o corpo e o ar
HORMÔNIO|Mensageiro químico produzido pelas glândulas
NEURÔNIO|Célula do sistema nervoso
TENDÃO|Tecido que liga o músculo ao osso
CÓRNEA|Parte transparente da frente do olho
ÍRIS|Parte colorida do olho
PUPILA|Abertura escura no centro do olho
` },
{ id: 'natureza', nome: 'Natureza e ambiente', icone: '🌳', cor: '#3f9a4b', lista: `
FLORESTA|Grande área coberta de árvores
ÁRVORE|Planta de tronco lenhoso e copa
FOLHA|Parte verde da planta que faz a fotossíntese
RAIZ|Parte da planta que absorve água do solo
SEMENTE|Origem de uma nova planta
FLOR|Parte da planta, geralmente colorida, ligada à reprodução
PÉTALA|Cada parte colorida da flor
CAULE|Parte da planta que sustenta folhas e flores
FRUTO|Parte da planta que protege as sementes
RIO|Curso natural de água doce
LAGO|Porção de água cercada de terra
MAR|Grande extensão de água salgada
OCEANO|A maior massa de água salgada da Terra
MONTANHA|Grande elevação natural do terreno
VULCÃO|Montanha que pode expelir lava
DESERTO|Região muito seca, com pouca chuva
PRAIA|Faixa de areia à beira-mar
ILHA|Porção de terra cercada de água por todos os lados
CACHOEIRA|Queda de água de um rio
CAVERNA|Cavidade natural dentro das rochas
GELEIRA|Grande massa de gelo que se move lentamente
PÂNTANO|Terreno alagado com muita vegetação
SAVANA|Planície com capim e árvores espalhadas
CERRADO|Bioma brasileiro de árvores de troncos tortos
CAATINGA|Bioma do sertão nordestino, adaptado à seca
PANTANAL|Maior planície alagável do mundo, no Brasil
AMAZÔNIA|Maior floresta tropical do mundo
CHUVA|Água que cai das nuvens
NUVEM|Massa de gotículas de água suspensa no céu
VENTO|Ar em movimento
NEVE|Precipitação de cristais de gelo
GRANIZO|Chuva de pedras de gelo
RELÂMPAGO|Clarão causado por uma descarga elétrica no céu
TROVÃO|Som forte que acompanha o raio
NEBLINA|Nuvem baixa que dificulta a visão
ORVALHO|Gotas de água que se formam nas plantas pela manhã
SECA|Longo período sem chuva
ENCHENTE|Transbordamento de água que alaga uma área
TERREMOTO|Tremor da crosta terrestre
FURACÃO|Tempestade giratória gigante formada sobre o oceano
TORNADO|Coluna de vento giratória e destrutiva
CLIMA|Padrão do tempo de uma região ao longo dos anos
RECICLAGEM|Transformação do lixo em matéria-prima novamente
POLUIÇÃO|Contaminação do ar, da água ou do solo
DESMATAMENTO|Derrubada das florestas
QUEIMADA|Uso do fogo para limpar terrenos, que prejudica a natureza
ECOSSISTEMA|Conjunto de seres vivos e do ambiente onde vivem
BIODIVERSIDADE|Variedade de formas de vida em um lugar
FOTOSSÍNTESE|Processo em que as plantas produzem alimento usando a luz
OXIGÊNIO|Gás essencial para a respiração
SOLO|Camada da terra onde as plantas crescem
AREIA|Grãos finos de rocha das praias e dos desertos
ROCHA|Material sólido e duro da crosta terrestre
MINERAL|Substância natural sólida como o quartzo
PEDRA|Fragmento de rocha
LAVA|Rocha derretida que sai do vulcão
COMPOSTAGEM|Transformação de restos orgânicos em adubo
SUSTENTÁVEL|Que usa os recursos sem esgotá-los para o futuro
NASCENTE|Lugar onde o rio começa
ESTUÁRIO|Lugar onde o rio encontra o mar
MANGUE|Ecossistema de lama e água salobra no litoral
CORAL|Animal marinho que forma recifes
SAMAMBAIA|Planta sem flores que se reproduz por esporos
CACTO|Planta do deserto que armazena água
MUSGO|Pequena planta que cresce em locais úmidos
COGUMELO|Fungo que tem a forma de um chapéu
BAMBU|Planta de caule oco que cresce muito rápido
ORQUÍDEA|Flor delicada com milhares de espécies
GIRASSOL|Flor amarela que se volta para o sol
ROSA|Flor perfumada com espinhos no caule
IPÊ|Árvore brasileira de flores roxas, amarelas ou brancas
` },
{ id: 'cores', nome: 'Cores e formas', icone: '🎨', cor: '#8e5bd1', lista: `
VERMELHO|Cor do sangue e do morango
AZUL|Cor do céu sem nuvens
AMARELO|Cor do sol e da gema do ovo
VERDE|Cor das folhas das árvores
ROXO|Cor da berinjela e da uva escura
PRETO|Cor da noite sem lua
BRANCO|Cor da neve e do leite
CINZA|Cor entre o preto e o branco
MARROM|Cor do chocolate e da terra
VIOLETA|Cor arroxeada, a última do arco-íris
DOURADO|Cor que lembra o ouro
PRATEADO|Cor que lembra a prata
BEGE|Cor clara parecida com a areia
TURQUESA|Cor entre o azul e o verde, nome de uma pedra
ESCARLATE|Tom de vermelho muito vivo
ANIL|Tom de azul escuro, também chamado de índigo
LILÁS|Tom de roxo bem claro
SALMÃO|Cor rosada com tom alaranjado
` },
{ id: 'paises', nome: 'Países do mundo', icone: '🌍', cor: '#2f86c9', lista: `
BRASIL|Maior país da América do Sul
ARGENTINA|País vizinho do Brasil, famoso pelo tango
CHILE|País longo e estreito entre os Andes e o Oceano Pacífico
PERU|País andino onde fica Machu Picchu
COLÔMBIA|País sul-americano famoso pela produção de café
VENEZUELA|País onde fica o Salto Ángel, a cachoeira mais alta do mundo
URUGUAI|País vizinho do Sul do Brasil, capital Montevidéu
PARAGUAI|País sem saída para o mar, capital Assunção
BOLÍVIA|País andino onde fica o lago Titicaca junto com o Peru
EQUADOR|País cortado pela linha do Equador, dono das ilhas Galápagos
MÉXICO|País da América do Norte onde viveram maias e astecas
CANADÁ|Segundo maior país do mundo em área
CUBA|Ilha caribenha cuja capital é Havana
PORTUGAL|País europeu que colonizou o Brasil
ESPANHA|País europeu cuja capital é Madri
FRANÇA|País da Torre Eiffel
ITÁLIA|País europeu em forma de bota
ALEMANHA|País europeu cuja capital é Berlim
INGLATERRA|País do Big Ben, parte do Reino Unido
IRLANDA|Ilha europeia conhecida pelo trevo verde
HOLANDA|País dos moinhos de vento e das tulipas
BÉLGICA|País europeu famoso pelos chocolates e waffles
SUÍÇA|País dos Alpes famoso pelos relógios e queijos
ÁUSTRIA|País de Viena, terra natal de Mozart
GRÉCIA|País considerado o berço da democracia e das Olimpíadas
RÚSSIA|Maior país do mundo em área
POLÔNIA|País europeu cuja capital é Varsóvia
SUÉCIA|País nórdico cuja capital é Estocolmo
NORUEGA|País nórdico famoso pelos fiordes
FINLÂNDIA|País nórdico conhecido como terra dos mil lagos
DINAMARCA|País nórdico cuja capital é Copenhague
ISLÂNDIA|Ilha nórdica de vulcões e gêiseres
TURQUIA|País entre a Europa e a Ásia, capital Ancara
EGITO|País das pirâmides de Gizé
MARROCOS|País do norte da África cuja capital é Rabat
NIGÉRIA|País mais populoso da África
QUÊNIA|País africano famoso pelos safáris
ANGOLA|País africano de língua portuguesa, capital Luanda
MOÇAMBIQUE|País africano de língua portuguesa banhado pelo Oceano Índico
ETIÓPIA|País africano considerado o berço do café
CHINA|País da Grande Muralha
JAPÃO|País conhecido como terra do sol nascente
ÍNDIA|País onde fica o Taj Mahal
TAILÂNDIA|País asiático cuja capital é Bangcoc
VIETNÃ|País asiático cuja capital é Hanói
INDONÉSIA|País asiático formado por milhares de ilhas
FILIPINAS|País-arquipélago asiático cuja capital é Manila
AUSTRÁLIA|País-continente onde vivem os cangurus
IRÃ|País do Oriente Médio antes chamado de Pérsia
IRAQUE|País onde ficava a antiga Mesopotâmia
MONGÓLIA|País asiático das estepes, terra de Gengis Khan
NEPAL|País do Himalaia onde fica o Monte Everest
JAMAICA|Ilha caribenha onde nasceu o reggae
HAITI|País caribenho que divide uma ilha com a República Dominicana
HONDURAS|País da América Central cuja capital é Tegucigalpa
PANAMÁ|País do canal que liga os oceanos Atlântico e Pacífico
` },
{ id: 'brasil', nome: 'Brasil', icone: '🇧🇷', cor: '#1f9d55', lista: `
BAHIA|Estado nordestino cuja capital é Salvador
PERNAMBUCO|Estado cuja capital é Recife
CEARÁ|Estado cuja capital é Fortaleza
PARANÁ|Estado cuja capital é Curitiba
GOIÁS|Estado cuja capital é Goiânia
AMAZONAS|Maior estado brasileiro em área, capital Manaus
PARÁ|Estado cuja capital é Belém
MARANHÃO|Estado cuja capital é São Luís
PIAUÍ|Estado cuja capital é Teresina
ALAGOAS|Estado cuja capital é Maceió
SERGIPE|Menor estado brasileiro, capital Aracaju
PARAÍBA|Estado cuja capital é João Pessoa
TOCANTINS|Estado mais novo do Brasil, capital Palmas
RONDÔNIA|Estado cuja capital é Porto Velho
RORAIMA|Estado mais ao norte do país, capital Boa Vista
AMAPÁ|Estado cuja capital é Macapá
ACRE|Estado cuja capital é Rio Branco
BRASÍLIA|Capital federal do Brasil, inaugurada em 1960
SALVADOR|Primeira capital do Brasil
RECIFE|Capital pernambucana conhecida como Veneza brasileira
FORTALEZA|Capital do Ceará
MANAUS|Capital do Amazonas, cercada pela floresta
BELÉM|Capital do Pará, famosa pelo mercado Ver-o-Peso
CURITIBA|Capital do Paraná
GOIÂNIA|Capital de Goiás
FLORIANÓPOLIS|Capital de Santa Catarina, fica em uma ilha
VITÓRIA|Capital do Espírito Santo
NATAL|Capital do Rio Grande do Norte
MACEIÓ|Capital de Alagoas
ARACAJU|Capital de Sergipe
TERESINA|Capital do Piauí
PALMAS|Capital do Tocantins
CUIABÁ|Capital de Mato Grosso
SAMBA|Ritmo musical que é símbolo do Brasil
CARNAVAL|Maior festa popular do Brasil
FREVO|Dança pernambucana feita com sombrinhas coloridas
CAPOEIRA|Arte afro-brasileira que mistura luta, dança e música
FORRÓ|Ritmo nordestino tocado com sanfona, zabumba e triângulo
CHIMARRÃO|Bebida quente de erva-mate típica do Sul
ACARAJÉ|Bolinho de feijão frito no dendê, típico da Bahia
SERTÃO|Região seca do interior do Nordeste
JANGADA|Embarcação de madeira dos pescadores do Nordeste
CORCOVADO|Morro do Rio de Janeiro onde fica o Cristo Redentor
IGUAÇU|Cataratas famosas na fronteira do Paraná com a Argentina
` },
{ id: 'ciencias', nome: 'Ciências', icone: '🔬', cor: '#13a3a3', lista: `
ÁTOMO|Menor parte de um elemento químico
MOLÉCULA|Grupo de átomos ligados entre si
ELÉTRON|Partícula de carga negativa do átomo
PRÓTON|Partícula de carga positiva do núcleo do átomo
NÊUTRON|Partícula sem carga do núcleo do átomo
CÉLULA|Unidade básica dos seres vivos
NÚCLEO|Centro da célula, onde fica o material genético
DNA|Molécula que carrega a informação genética
GENE|Trecho do DNA que determina uma característica
BACTÉRIA|Ser vivo de uma só célula, sem núcleo definido
VÍRUS|Agente infeccioso que só se reproduz dentro de células
FUNGO|Ser vivo do grupo dos bolores e cogumelos
ENERGIA|Capacidade de realizar trabalho
GRAVIDADE|Força que atrai os corpos para o centro da Terra
MASSA|Quantidade de matéria de um corpo
VELOCIDADE|Distância percorrida em certo tempo
ACELERAÇÃO|Variação da velocidade ao longo do tempo
FORÇA|Ação capaz de mudar o movimento de um corpo
ATRITO|Força que resiste ao deslizamento entre superfícies
INÉRCIA|Tendência de um corpo manter seu estado de movimento
PRESSÃO|Força aplicada sobre uma área
TEMPERATURA|Medida da agitação das partículas de um corpo
CALOR|Energia que passa do corpo quente para o frio
LUZ|Radiação que nos permite enxergar
SOM|Onda mecânica que ouvimos
ONDA|Perturbação que transporta energia
ÍMÃ|Objeto que atrai o ferro
ELETRICIDADE|Fenômeno ligado ao movimento de cargas elétricas
CORRENTE|Fluxo de cargas elétricas em um condutor
CIRCUITO|Caminho fechado por onde passa a corrente elétrica
LENTE|Vidro curvo que desvia a luz, usado nos óculos
ESPELHO|Superfície lisa que reflete a imagem
PRISMA|Objeto transparente que separa a luz branca em cores
REFRAÇÃO|Desvio da luz ao passar de um meio para outro
DENSIDADE|Relação entre a massa e o volume
VOLUME|Espaço ocupado por um corpo
SÓLIDO|Estado da matéria com forma definida
LÍQUIDO|Estado da matéria que toma a forma do recipiente
GÁS|Estado da matéria que se espalha ocupando todo o espaço
EVAPORAÇÃO|Passagem lenta do estado líquido para o gasoso
CONDENSAÇÃO|Passagem do estado gasoso para o líquido
FUSÃO|Passagem do estado sólido para o líquido
HIDROGÊNIO|Elemento mais leve e abundante do universo
CARBONO|Elemento base da vida, presente no carvão e no diamante
NITROGÊNIO|Gás mais abundante no ar
FERRO|Metal usado para fazer o aço
OURO|Metal precioso amarelo de símbolo Au
PRATA|Metal precioso de símbolo Ag
COBRE|Metal avermelhado que conduz bem a eletricidade
ALUMÍNIO|Metal leve usado nas latinhas
MERCÚRIO|Metal que é líquido na temperatura ambiente
ÁCIDO|Substância de sabor azedo como o vinagre
SOLUÇÃO|Mistura uniforme de substâncias
REAÇÃO|Transformação química de substâncias
CATALISADOR|Substância que acelera uma reação sem ser consumida
EVOLUÇÃO|Mudança das espécies ao longo das gerações
FÓSSIL|Resto ou marca de ser vivo preservado nas rochas
DINOSSAURO|Réptil gigante que viveu há milhões de anos
ESPÉCIE|Grupo de seres capazes de se reproduzir entre si
HABITAT|Lugar onde uma espécie vive naturalmente
PREDADOR|Animal que caça outros para se alimentar
HERBÍVORO|Animal que se alimenta de plantas
CARNÍVORO|Animal que se alimenta de carne
ONÍVORO|Animal que come plantas e carne
MAMÍFERO|Animal que amamenta os filhotes
RÉPTIL|Animal de escamas que depende do calor do ambiente
ANFÍBIO|Animal que vive parte na água, parte na terra
INVERTEBRADO|Animal sem coluna vertebral
CLOROFILA|Pigmento verde das plantas
MICROSCÓPIO|Instrumento para ver coisas minúsculas
LABORATÓRIO|Lugar onde se fazem experimentos científicos
HIPÓTESE|Explicação provisória que ainda será testada
EXPERIMENTO|Teste feito para verificar uma hipótese
CIENTISTA|Pessoa que pesquisa para entender a natureza
` },
{ id: 'matematica', nome: 'Matemática', icone: '📐', cor: '#4a63d6', lista: `
SOMA|Resultado de uma adição
SUBTRAÇÃO|Operação de tirar um número de outro
MULTIPLICAÇÃO|Operação de somar parcelas iguais várias vezes
DIVISÃO|Operação de repartir em partes iguais
FRAÇÃO|Representação de partes de um inteiro
DECIMAL|Sistema de numeração de base dez
NÚMERO|Símbolo que representa uma quantidade
DÍGITO|Cada um dos algarismos de 0 a 9
PAR|Número que pode ser dividido por dois sem sobrar resto
ÍMPAR|Número que deixa resto ao ser dividido por dois
PRIMO|Número divisível apenas por um e por ele mesmo
DOBRO|Duas vezes uma quantidade
METADE|Uma das duas partes iguais de um todo
TRIPLO|Três vezes uma quantidade
DÚZIA|Conjunto de doze unidades
DEZENA|Conjunto de dez unidades
CENTENA|Conjunto de cem unidades
MILHAR|Conjunto de mil unidades
ZERO|Número que representa nenhuma quantidade
POTÊNCIA|Multiplicação de um número por ele mesmo várias vezes
PORCENTAGEM|Parte de cem, indicada pelo símbolo %
MÉDIA|Soma dos valores dividida pela quantidade deles
EQUAÇÃO|Igualdade que tem um valor desconhecido
INCÓGNITA|Valor desconhecido de uma equação
GRÁFICO|Desenho que mostra dados de forma visual
TABELA|Organização de dados em linhas e colunas
TRIÂNGULO|Figura plana de três lados
QUADRADO|Figura de quatro lados iguais e ângulos retos
RETÂNGULO|Figura de quatro ângulos retos e lados opostos iguais
CÍRCULO|Figura plana redonda
LOSANGO|Figura de quatro lados iguais e ângulos não retos
PENTÁGONO|Figura plana de cinco lados
HEXÁGONO|Figura de seis lados, como os favos de mel
CUBO|Sólido de seis faces quadradas, como um dado
ESFERA|Sólido perfeitamente redondo, como uma bola
CILINDRO|Sólido com duas bases circulares, como uma lata
CONE|Sólido de base circular e ponta, como uma casquinha
PIRÂMIDE|Sólido de base poligonal e faces triangulares
ÂNGULO|Abertura entre duas linhas que se encontram
RETA|Linha que não faz curva
DIÂMETRO|Segmento que atravessa o círculo passando pelo centro
RAIO|Distância do centro do círculo até a borda
PERÍMETRO|Soma das medidas dos lados de uma figura
ÁREA|Medida da superfície de uma figura
SIMETRIA|Igualdade das partes em relação a um eixo
PARALELA|Reta que nunca encontra a outra
VÉRTICE|Ponto onde dois lados se encontram
ARESTA|Linha onde duas faces de um sólido se encontram
INFINITO|Aquilo que não tem fim
ESTATÍSTICA|Área que coleta e analisa dados
PROBABILIDADE|Chance de algo acontecer
` },
{ id: 'profissoes', nome: 'Profissões', icone: '👩‍🔧', cor: '#7a6a58', lista: `
MÉDICO|Profissional que diagnostica e trata doenças
ENFERMEIRO|Profissional que cuida dos pacientes no hospital
DENTISTA|Profissional que cuida dos dentes
PROFESSOR|Profissional que ensina
ENGENHEIRO|Profissional que projeta construções e máquinas
ARQUITETO|Profissional que projeta edifícios
ADVOGADO|Profissional que defende pessoas na justiça
JUIZ|Autoridade que julga os processos
POLICIAL|Profissional que garante a segurança pública
BOMBEIRO|Profissional que apaga incêndios e faz resgates
CARTEIRO|Profissional que entrega cartas
PADEIRO|Profissional que faz pães
COZINHEIRO|Profissional que prepara refeições
GARÇOM|Profissional que serve as mesas no restaurante
MOTORISTA|Profissional que dirige veículos
PILOTO|Profissional que conduz aviões
MECÂNICO|Profissional que conserta motores
ELETRICISTA|Profissional que faz instalações elétricas
ENCANADOR|Profissional que conserta canos
PEDREIRO|Profissional que ergue paredes e constrói casas
PINTOR|Profissional que pinta paredes ou quadros
CARPINTEIRO|Profissional que trabalha com madeira
JARDINEIRO|Profissional que cuida de jardins
AGRICULTOR|Profissional que cultiva a terra
PESCADOR|Profissional que vive da pesca
VETERINÁRIO|Médico dos animais
FARMACÊUTICO|Profissional especialista em medicamentos
PSICÓLOGO|Profissional que cuida da saúde mental
JORNALISTA|Profissional que apura e divulga notícias
FOTÓGRAFO|Profissional que tira fotos
ATOR|Profissional que interpreta personagens
CANTOR|Profissional que canta
MÚSICO|Profissional que toca instrumentos
ESCRITOR|Profissional que escreve livros
BIBLIOTECÁRIO|Profissional que organiza bibliotecas
ASTRONAUTA|Profissional que viaja ao espaço
PROGRAMADOR|Profissional que escreve programas de computador
CABELEIREIRO|Profissional que corta e arruma cabelos
COSTUREIRA|Profissional que costura roupas
SAPATEIRO|Profissional que conserta sapatos
BARBEIRO|Profissional que faz barba e corta cabelo
VENDEDOR|Profissional que vende produtos
CONTADOR|Profissional que cuida das contas de empresas
ECONOMISTA|Profissional que estuda a economia
GEÓLOGO|Profissional que estuda as rochas e o solo
BIÓLOGO|Profissional que estuda os seres vivos
ARQUEÓLOGO|Profissional que estuda civilizações antigas por seus vestígios
HISTORIADOR|Profissional que estuda o passado
TRADUTOR|Profissional que passa textos de uma língua para outra
GUIA|Profissional que acompanha turistas
ATLETA|Pessoa que pratica esporte profissionalmente
TREINADOR|Profissional que prepara atletas e times
NUTRICIONISTA|Profissional que orienta a alimentação
SOLDADO|Integrante do exército
MARINHEIRO|Profissional que trabalha em navios
DETETIVE|Profissional que investiga mistérios
` },
{ id: 'esportes', nome: 'Esportes e lazer', icone: '⚽', cor: '#e0a21b', lista: `
FUTEBOL|Esporte mais popular do Brasil
VÔLEI|Esporte de rede com seis jogadores em cada time
BASQUETE|Esporte em que se arremessa a bola na cesta
HANDEBOL|Esporte jogado com as mãos e um gol pequeno
TÊNIS|Esporte de raquete jogado em quadra com rede
NATAÇÃO|Esporte praticado na piscina
ATLETISMO|Conjunto de corridas, saltos e arremessos
CICLISMO|Esporte praticado com bicicleta
SURFE|Esporte de deslizar nas ondas sobre uma prancha
SKATE|Esporte praticado sobre uma prancha com rodinhas
JUDÔ|Arte marcial japonesa de quedas e imobilizações
KARATÊ|Arte marcial japonesa de golpes com mãos e pés
BOXE|Luta com luvas em que se usam os punhos
XADREZ|Jogo de tabuleiro com rei, rainha e cavalos
DAMAS|Jogo de tabuleiro com peças que pulam umas sobre as outras
GINÁSTICA|Esporte de acrobacias, força e flexibilidade
ESGRIMA|Luta esportiva com espadas
REMO|Esporte de conduzir um barco com remos
GOLFE|Esporte de acertar a bola em buracos usando tacos
BEISEBOL|Esporte de taco muito popular nos Estados Unidos
RÚGBI|Esporte de bola oval com muito contato físico
POLO|Esporte jogado a cavalo com tacos
MARATONA|Corrida de cerca de 42 quilômetros
OLIMPÍADA|Grande competição esportiva mundial realizada a cada quatro anos
MEDALHA|Prêmio dado aos primeiros colocados de uma competição
TROFÉU|Taça entregue ao campeão
ÁRBITRO|Responsável por aplicar as regras na partida
GOLEIRO|Jogador que defende o gol
ESTÁDIO|Local onde acontecem os grandes jogos
TORCIDA|Grupo de fãs que apoia um time
CAMPEONATO|Competição disputada por várias equipes
RAQUETE|Instrumento usado para rebater a bola no tênis
PATINS|Calçado com rodas ou lâmina para deslizar
PIPA|Brinquedo que voa preso a uma linha
PIÃO|Brinquedo que gira sobre uma ponta
BOLICHE|Jogo de derrubar pinos com uma bola
BARALHO|Conjunto de cartas usado em vários jogos
DOMINÓ|Jogo de peças retangulares marcadas com pontos
BAMBOLÊ|Aro que se gira na cintura
AMARELINHA|Brincadeira de pular em casas desenhadas no chão
CAMBALHOTA|Giro do corpo para frente apoiando as mãos no chão
ACAMPAMENTO|Estadia ao ar livre em barracas
PESCARIA|Atividade de pescar por diversão
TRILHA|Caminho na natureza usado para caminhadas
PIQUENIQUE|Refeição ao ar livre sobre uma toalha
PARQUE|Área pública de lazer com árvores
CINEMA|Lugar onde se assistem filmes
TEATRO|Lugar onde se assistem peças encenadas
MUSEU|Lugar que guarda e expõe obras e objetos históricos
VIAGEM|Deslocamento para conhecer outros lugares
FÉRIAS|Período de descanso do trabalho ou da escola
` },
{ id: 'musica', nome: 'Música e arte', icone: '🎻', cor: '#b0479b', lista: `
VIOLÃO|Instrumento de seis cordas muito popular no Brasil
GUITARRA|Instrumento de cordas elétrico típico do rock
PIANO|Instrumento de teclas brancas e pretas
BATERIA|Conjunto de tambores e pratos
FLAUTA|Instrumento de sopro com furos
SAXOFONE|Instrumento de sopro de metal muito usado no jazz
TROMPETE|Instrumento de sopro de metal com pistões
VIOLINO|Instrumento de cordas tocado com arco, apoiado no ombro
VIOLONCELO|Instrumento de cordas grande tocado sentado
HARPA|Instrumento de muitas cordas tocado com os dedos
SANFONA|Instrumento de fole típico do forró
PANDEIRO|Instrumento de percussão com platinelas, essencial no samba
CAVAQUINHO|Pequeno instrumento de quatro cordas do samba e do choro
BERIMBAU|Instrumento de arco e cabaça usado na capoeira
TAMBOR|Instrumento de percussão com pele esticada
MELODIA|Sequência de notas que forma uma música
RITMO|Organização dos sons ao longo do tempo
HARMONIA|Combinação agradável de sons simultâneos
NOTA|Cada som musical, como dó, ré e mi
PARTITURA|Papel onde a música está escrita em notas
ORQUESTRA|Grande conjunto de músicos com um regente
MAESTRO|Regente de uma orquestra
CORO|Grupo de pessoas que cantam juntas
REFRÃO|Parte da música que se repete
CANÇÃO|Composição musical feita para ser cantada
ÓPERA|Teatro todo cantado com orquestra
BALÉ|Dança clássica feita na ponta dos pés
PINTURA|Arte de criar imagens com tintas
ESCULTURA|Arte de modelar figuras em três dimensões
DESENHO|Imagem feita com lápis ou caneta
AQUARELA|Pintura feita com tinta diluída em água
MOSAICO|Imagem formada por pequenos pedaços coloridos
GRAFITE|Arte de pintar muros com spray
PINCEL|Instrumento com pelos usado para pintar
TELA|Tecido esticado onde se pinta um quadro
PALETA|Placa onde o pintor mistura as tintas
RETRATO|Pintura ou foto de uma pessoa
PAISAGEM|Imagem que mostra um cenário
CERÂMICA|Arte de fazer objetos de argila queimada no forno
ARTESANATO|Objetos feitos à mão
ORIGAMI|Arte japonesa de dobrar papel
POESIA|Arte de escrever em versos
ROMANCE|Narrativa longa de ficção
CONTO|Narrativa curta de ficção
FÁBULA|História com animais que termina com uma moral
LENDA|História popular que mistura fatos e fantasia
CORDEL|Literatura popular nordestina vendida pendurada em barbantes
NOVELA|História em capítulos transmitida pela televisão
PERSONAGEM|Figura que participa de uma história
AUTOR|Pessoa que cria uma obra
` },
{ id: 'transportes', nome: 'Transportes', icone: '🚲', cor: '#5b7f99', lista: `
CARRO|Veículo de quatro rodas para passageiros
ÔNIBUS|Veículo grande de transporte coletivo
CAMINHÃO|Veículo pesado que transporta cargas
MOTOCICLETA|Veículo de duas rodas com motor
BICICLETA|Veículo de duas rodas movido a pedal
TREM|Veículo que anda sobre trilhos
METRÔ|Trem urbano que geralmente anda debaixo da terra
AVIÃO|Veículo que voa com asas e motores
HELICÓPTERO|Aeronave com hélices no teto
NAVIO|Grande embarcação
BARCO|Embarcação pequena ou média
CANOA|Barco estreito movido a remo
SUBMARINO|Embarcação que navega debaixo da água
FOGUETE|Veículo que leva cargas e naves ao espaço
BALÃO|Aeronave que voa com ar quente
TÁXI|Carro de aluguel com motorista
AMBULÂNCIA|Veículo que transporta doentes com urgência
BONDE|Veículo elétrico sobre trilhos nas ruas da cidade
CARROÇA|Veículo de madeira puxado por animais
PATINETE|Veículo com prancha e guidão
TRATOR|Veículo usado no trabalho do campo
VOLANTE|Peça usada para dirigir o carro
PNEU|Borracha que envolve a roda
MOTOR|Máquina que produz o movimento do veículo
FREIO|Mecanismo que faz o veículo parar
SEMÁFORO|Sinal de luzes verde, amarela e vermelha
RODOVIA|Estrada para veículos que liga cidades
PONTE|Construção que atravessa rios ou vales
TÚNEL|Passagem por baixo da terra ou através de montanhas
AEROPORTO|Lugar de pouso e decolagem de aviões
PORTO|Lugar onde os navios atracam
ESTAÇÃO|Lugar de embarque e desembarque de trens
PASSAGEM|Bilhete que dá direito à viagem
PEDÁGIO|Taxa paga para usar uma rodovia
CAPACETE|Proteção para a cabeça de motociclistas e ciclistas
CINTO|Item de segurança que prende o passageiro ao banco
GASOLINA|Combustível derivado do petróleo
ÂNCORA|Peça pesada que prende o barco ao fundo
` },
{ id: 'portugues', nome: 'Língua portuguesa', icone: '📝', cor: '#c0552f', lista: `
SUBSTANTIVO|Palavra que dá nome aos seres e às coisas
ADJETIVO|Palavra que dá características ao substantivo
VERBO|Palavra que indica ação, estado ou fenômeno
ADVÉRBIO|Palavra que modifica o verbo, como "rapidamente"
PRONOME|Palavra que substitui o nome, como "ele"
ARTIGO|Palavra que vem antes do substantivo, como "o" e "a"
PREPOSIÇÃO|Palavra que liga termos, como "de" e "para"
CONJUNÇÃO|Palavra que liga orações, como "e" e "mas"
INTERJEIÇÃO|Palavra que expressa emoção, como "ufa!"
SÍLABA|Cada parte da palavra pronunciada de uma só vez
VOGAL|Letra como A, E, I, O e U
CONSOANTE|Letra que precisa de vogal para formar sílaba
ALFABETO|Conjunto ordenado das letras
ACENTO|Sinal que indica a sílaba tônica ou o som da vogal
CRASE|Fusão de "a" com "a", marcada pelo acento grave
VÍRGULA|Sinal que indica uma pausa breve na frase
PONTO|Sinal que encerra uma frase
FRASE|Enunciado com sentido completo
ORAÇÃO|Frase organizada em torno de um verbo
SUJEITO|Termo sobre quem se fala na oração
PREDICADO|Aquilo que se declara sobre o sujeito
SINÔNIMO|Palavra de sentido igual ou parecido
ANTÔNIMO|Palavra de sentido oposto
HOMÔNIMO|Palavra de mesma pronúncia ou escrita e sentido diferente
PLURAL|Forma da palavra que indica mais de um
SINGULAR|Forma da palavra que indica apenas um
FEMININO|Gênero de palavras como "menina"
MASCULINO|Gênero de palavras como "menino"
DIMINUTIVO|Forma que indica tamanho menor, como "casinha"
AUMENTATIVO|Forma que indica tamanho maior, como "casarão"
PARÁGRAFO|Bloco de texto que começa com um recuo
TEXTO|Conjunto de frases que formam um sentido
REDAÇÃO|Texto escrito sobre um tema
RIMA|Repetição de sons no final dos versos
VERSO|Cada linha de um poema
ESTROFE|Conjunto de versos de um poema
METÁFORA|Comparação feita sem a palavra "como"
DICIONÁRIO|Livro que explica o significado das palavras
GRAMÁTICA|Conjunto de regras de uma língua
ORTOGRAFIA|Forma correta de escrever as palavras
SOTAQUE|Jeito de pronunciar típico de uma região
GÍRIA|Linguagem informal de um grupo
IDIOMA|Língua de um povo
ADIVINHA|Pergunta em forma de enigma para descobrir a resposta
PALAVRA|Unidade da língua formada por letras e com significado
` },
{ id: 'tecnologia', nome: 'Tecnologia', icone: '💻', cor: '#3b6fb6', lista: `
COMPUTADOR|Máquina que processa dados
TECLADO|Conjunto de teclas para digitar
MOUSE|Dispositivo que move o cursor na tela
MONITOR|Tela do computador
IMPRESSORA|Aparelho que passa documentos para o papel
INTERNET|Rede mundial de computadores
SITE|Conjunto de páginas na internet
NAVEGADOR|Programa usado para acessar sites
SENHA|Código secreto de acesso
USUÁRIO|Pessoa que usa um sistema
ARQUIVO|Conjunto de dados salvo com um nome
PASTA|Lugar onde se organizam arquivos
PROGRAMA|Conjunto de instruções que o computador executa
APLICATIVO|Programa usado no celular
ALGORITMO|Sequência de passos para resolver um problema
CÓDIGO|Instruções escritas em uma linguagem de programação
ROBÔ|Máquina programada para realizar tarefas
CELULAR|Telefone portátil
TABLET|Computador portátil em forma de prancheta
NOTEBOOK|Computador portátil que se dobra
CARREGADOR|Aparelho que recarrega a bateria
CABO|Fio que conecta aparelhos
EMAIL|Mensagem enviada pela internet, o correio eletrônico
DOWNLOAD|Ato de baixar um arquivo da internet
MEMÓRIA|Parte do computador que guarda informações
PROCESSADOR|Peça que executa os cálculos do computador
PIXEL|Menor ponto de uma imagem digital
VIDEOGAME|Aparelho de jogos eletrônicos
CÂMERA|Aparelho que captura fotos e vídeos
DRONE|Pequena aeronave controlada à distância
SATÉLITE|Objeto que orbita a Terra e transmite sinais
ANTENA|Peça que recebe ou emite ondas de rádio
RÁDIO|Aparelho que transmite sons por ondas
BINÁRIO|Sistema de numeração com apenas 0 e 1
DADOS|Informações armazenadas e processadas
REDE|Conjunto de computadores conectados
SERVIDOR|Computador que oferece serviços a outros
BACKUP|Cópia de segurança de arquivos
ÍCONE|Pequena imagem que representa um programa
CURSOR|Seta ou traço que indica a posição na tela
TECNOLOGIA|Uso do conhecimento científico para criar ferramentas
INOVAÇÃO|Criação de algo novo e útil
` },
{ id: 'historia', nome: 'História e cidadania', icone: '🏛️', cor: '#9a7b3c', lista: `
DESCOBRIMENTO|Chegada dos portugueses ao Brasil em 1500
INDEPENDÊNCIA|Separação do Brasil de Portugal, proclamada em 1822
REPÚBLICA|Forma de governo proclamada no Brasil em 1889
ABOLIÇÃO|Fim da escravidão no Brasil, em 1888
IMPÉRIO|Período em que o Brasil foi governado por imperadores
COLÔNIA|Território dominado e explorado por outro país
CAPITANIA|Faixa de terra em que Portugal dividiu o Brasil colonial
QUILOMBO|Comunidade formada por pessoas escravizadas que fugiram
BANDEIRANTE|Explorador que avançava pelo interior do Brasil colonial
INCONFIDÊNCIA|Movimento em Minas Gerais contra o domínio português
TIRADENTES|Herói da Inconfidência Mineira
CABRAL|Navegador português que chegou ao Brasil em 1500
INDÍGENA|Pertencente aos povos originários das Américas
FARAÓ|Rei do antigo Egito
MÚMIA|Corpo preservado pelos antigos egípcios
GLADIADOR|Lutador que combatia em arenas na Roma antiga
CAVALEIRO|Guerreiro medieval montado a cavalo
CASTELO|Fortaleza medieval com torres e muralhas
REI|Monarca que governa um reino
RAINHA|Monarca do sexo feminino ou esposa do rei
PRÍNCIPE|Filho do rei
IMPERADOR|Governante de um império
DEMOCRACIA|Governo em que o povo escolhe seus representantes
ELEIÇÃO|Escolha de representantes por meio do voto
VOTO|Escolha feita pelo eleitor
PRESIDENTE|Chefe de Estado em uma república
GOVERNADOR|Chefe do poder executivo de um estado
PREFEITO|Chefe do poder executivo de um município
VEREADOR|Representante eleito na câmara municipal
SENADOR|Membro do Senado
CONSTITUIÇÃO|Lei maior de um país
CIDADANIA|Conjunto de direitos e deveres do cidadão
DIREITO|Aquilo que a lei garante a cada pessoa
DEVER|Obrigação de cada cidadão
LEI|Regra criada pelo poder legislativo
JUSTIÇA|Respeito aos direitos de cada um
LIBERDADE|Direito de agir e pensar por si mesmo
IGUALDADE|Princípio de que todos têm os mesmos direitos
RESPEITO|Consideração pelas outras pessoas
REVOLUÇÃO|Mudança profunda na sociedade ou no governo
GUERRA|Conflito armado entre grupos ou países
PAZ|Ausência de guerras e conflitos
TRATADO|Acordo formal entre países
BANDEIRA|Símbolo de pano que representa um país
HINO|Canção que representa uma nação
MOEDA|Peça de metal usada como dinheiro
ESCAMBO|Troca de mercadorias sem uso de dinheiro
CIVILIZAÇÃO|Sociedade organizada com cultura própria
TRADIÇÃO|Costume passado de geração em geração
CULTURA|Conjunto de costumes, artes e saberes de um povo
PATRIMÔNIO|Bem cultural ou natural que deve ser preservado
` },
{ id: 'sentimentos', nome: 'Sentimentos e atitudes', icone: '💛', cor: '#e2b13c', lista: `
ALEGRIA|Sentimento de felicidade e contentamento
TRISTEZA|Sentimento de pesar e desânimo
AMOR|Sentimento de carinho profundo por alguém
SAUDADE|Falta que se sente de alguém ou de algo distante
MEDO|Sensação diante de um perigo ou ameaça
RAIVA|Sentimento de irritação intensa
CORAGEM|Força para enfrentar o medo
CALMA|Estado de tranquilidade
AMIZADE|Relação de afeto entre amigos
GRATIDÃO|Reconhecimento por algo recebido
ESPERANÇA|Confiança de que algo bom vai acontecer
CIÚME|Medo de perder alguém para outra pessoa
ORGULHO|Satisfação com algo que se fez
VERGONHA|Constrangimento diante dos outros
SURPRESA|Reação diante do inesperado
TÉDIO|Sensação de cansaço por falta de interesse
EMPATIA|Capacidade de se colocar no lugar do outro
GENTILEZA|Atitude de ser educado e atencioso
HONESTIDADE|Qualidade de quem fala a verdade
PACIÊNCIA|Capacidade de esperar com calma
HUMILDADE|Qualidade de quem não se acha superior aos outros
GENEROSO|Que gosta de dividir o que tem
SINCERO|Que diz o que realmente pensa
CORAJOSO|Que não foge diante do perigo
TÍMIDO|Que tem dificuldade de se expor
CURIOSO|Que tem vontade de aprender e descobrir
ESFORÇADO|Que se dedica muito ao que faz
CRIATIVO|Que tem facilidade para criar ideias
TEIMOSO|Que não muda de opinião facilmente
PREGUIÇOSO|Que evita qualquer esforço
EDUCADO|Que trata os outros com cortesia
SIMPÁTICO|Que é agradável no trato com as pessoas
ANSIOSO|Que fica inquieto esperando algo
FELIZ|Que está alegre
CANSADO|Que precisa de descanso
CONFIANTE|Que acredita em si mesmo
RESPONSÁVEL|Que cumpre seus compromissos
ORGANIZADO|Que mantém tudo em ordem
SOLIDÁRIO|Que ajuda quem precisa
LEAL|Que é fiel a alguém ou a uma causa
PERSISTENTE|Que não desiste facilmente
OTIMISTA|Que vê o lado bom das coisas
PESSIMISTA|Que espera sempre o pior
ENTUSIASMO|Animação e vontade intensas
COMPAIXÃO|Sentimento de pena e vontade de ajudar quem sofre
PERDÃO|Ato de desculpar uma ofensa
SABEDORIA|Conhecimento unido ao bom senso
CARINHO|Demonstração de afeto
` },
{ id: 'acoes', nome: 'Verbos e ações', icone: '🏃', cor: '#e2683c', lista: `
CORRER|Mover-se rapidamente com as pernas
PULAR|Erguer o corpo do chão com um impulso
NADAR|Mover-se dentro da água
VOAR|Deslocar-se pelo ar
ANDAR|Mover-se a pé
DORMIR|Descansar em estado de sono
ACORDAR|Sair do sono
COMER|Ingerir alimentos
BEBER|Ingerir líquidos
ESTUDAR|Dedicar-se a aprender um assunto
APRENDER|Adquirir conhecimento
ENSINAR|Transmitir conhecimento
LER|Interpretar um texto escrito
ESCREVER|Registrar palavras no papel ou na tela
DESENHAR|Fazer traços que formam uma imagem
CANTAR|Produzir música com a voz
DANÇAR|Mover o corpo no ritmo da música
SORRIR|Mostrar alegria com os lábios
CHORAR|Derramar lágrimas
ABRAÇAR|Envolver alguém com os braços
OUVIR|Perceber os sons
FALAR|Expressar-se com palavras
PENSAR|Usar a mente para refletir
SONHAR|Ter imagens durante o sono ou desejar muito algo
CONSTRUIR|Erguer, edificar
DESTRUIR|Pôr abaixo, arruinar
COZINHAR|Preparar alimentos com o calor
LIMPAR|Tirar a sujeira
LAVAR|Limpar usando água
VARRER|Limpar o chão com a vassoura
PLANTAR|Colocar sementes ou mudas na terra
VIAJAR|Ir de um lugar para outro distante
EXPLORAR|Percorrer um lugar para descobrir coisas
DESCOBRIR|Encontrar algo desconhecido
INVENTAR|Criar algo que não existia
PERGUNTAR|Fazer uma pergunta para saber algo
RESPONDER|Dar uma resposta
AJUDAR|Prestar auxílio a alguém
COMPARTILHAR|Dividir algo com os outros
ECONOMIZAR|Gastar menos, poupar
CONTAR|Dizer os números em ordem ou narrar uma história
MEDIR|Determinar o tamanho de algo
CALCULAR|Fazer contas
OBSERVAR|Olhar com atenção
LEMBRAR|Trazer algo de volta à memória
ESQUECER|Perder algo da memória
VENCER|Ganhar uma disputa
TREINAR|Praticar para melhorar
CRIAR|Dar existência a algo novo
` },
{ id: 'espaco', nome: 'Espaço e Terra', icone: '🪐', cor: '#4b3fa0', lista: `
SOL|Estrela no centro do nosso sistema
LUA|Satélite natural da Terra
TERRA|Planeta onde vivemos
VÊNUS|Planeta mais quente do Sistema Solar
MARTE|Planeta conhecido como planeta vermelho
JÚPITER|Maior planeta do Sistema Solar
SATURNO|Planeta famoso por seus anéis
URANO|Planeta que gira praticamente deitado
NETUNO|Planeta mais distante do Sol
PLUTÃO|Planeta-anão nos confins do Sistema Solar
ESTRELA|Astro que tem luz própria
PLANETA|Astro que gira em torno de uma estrela
GALÁXIA|Imenso conjunto de estrelas, gás e poeira
COMETA|Astro de gelo e poeira com cauda brilhante
ASTEROIDE|Pequeno corpo rochoso que orbita o Sol
METEORO|Rastro de luz de uma rocha queimando na atmosfera
ÓRBITA|Caminho de um astro ao redor de outro
ECLIPSE|Quando um astro esconde outro da nossa vista
CONSTELAÇÃO|Grupo de estrelas que forma uma figura no céu
TELESCÓPIO|Instrumento para observar astros distantes
ATMOSFERA|Camada de gases que envolve a Terra
UNIVERSO|Tudo o que existe no espaço
NEBULOSA|Nuvem de gás e poeira onde nascem estrelas
EQUINÓCIO|Dia em que noite e dia têm quase a mesma duração
SOLSTÍCIO|Dia mais longo ou mais curto do ano
ROTAÇÃO|Giro da Terra em torno de si mesma
TRANSLAÇÃO|Volta da Terra ao redor do Sol
CRATERA|Buraco causado pelo impacto de um meteorito
HEMISFÉRIO|Cada metade da Terra dividida pela linha do Equador
LATITUDE|Distância em graus em relação à linha do Equador
LONGITUDE|Distância em graus em relação ao meridiano de Greenwich
BÚSSOLA|Instrumento que aponta para o norte
MAPA|Representação plana de um território
GLOBO|Representação esférica da Terra
NORTE|Ponto cardeal oposto ao sul
LESTE|Ponto cardeal do lado onde o sol nasce
OESTE|Ponto cardeal do lado onde o sol se põe
` },
];

// Converte as listas em entradas { w: palavra normalizada, d: palavra com acento, c: dica, cat }
(function () {
  const vistos = new Set();
  window.normalizar = (p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  window.TODAS_PALAVRAS = [];
  for (const cat of window.CATEGORIAS) {
    cat.palavras = [];
    for (const linha of cat.lista.split('\n')) {
      const t = linha.trim();
      if (!t) continue;
      const [d, c] = t.split('|');
      const w = window.normalizar(d);
      if (!c || w.length < 3 || w.length > 14 || vistos.has(w)) continue;
      vistos.add(w);
      const e = { w, d: d.trim(), dica: c.trim(), cat: cat.id };
      cat.palavras.push(e);
      window.TODAS_PALAVRAS.push(e);
    }
    delete cat.lista;
  }
})();
