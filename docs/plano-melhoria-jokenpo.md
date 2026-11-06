# Plano de melhoria: Jokenpo Online

Versão 2, de 06/11/2026: decisões registradas e Fase 0 incorporada à Fase 1.

**Resumo:** o jogo funciona no caminho feliz, mas tem quatro problemas estruturais:

- **Trapaça possível:** a jogada do adversário chega ao navegador antes de você jogar.
- **Banco aberto:** qualquer pessoa lê qualquer sala, sem autenticação, e provavelmente também escreve.
- **Saída de jogador mal tratada:** quem fecha a aba fica "dentro" da sala para sempre.
- **Lógica e interface misturadas:** as regras do jogo, o Firebase e o DOM estão no mesmo arquivo de 948 linhas, e o próprio DOM é usado como fonte de estado.

A proposta é reescrever na arquitetura do `simulador-brasileirao-2026`, em quatro camadas: `domain`, `application`, `infrastructure` e `ui`. A stack seria Vite, TypeScript e Vitest, com um teste que garante a separação das camadas. A seção 4 também troca o modelo de dados: em vez de "placar que alguém atualiza", a partida passa a guardar o "histórico de rodadas", e o placar é calculado a partir dele. Isso elimina a maior parte dos bugs de sincronização.

---

## 1. Diagnóstico

### 1.1 Segurança e integridade

| # | Problema | Onde | Impacto |
|---|---|---|---|
| S1 | **A jogada do adversário fica visível antes de você jogar.** O listener recebe a sala inteira, com `player1.move` e `player2.move` em texto puro. A tela mostra "✓", mas o valor está no snapshot e aparece em qualquer DevTools. | `gameLogic.js:209`, `:329-330` | Quem joga por último pode sempre vencer. |
| S2 | **Leitura aberta sem autenticação.** `GET /rooms/ABCD.json` responde `200` sem token. Isso foi testado em 06/11/2026; a escrita não foi testada. Não há `database.rules.json` no repositório, então as regras só existem no console. | Firebase | Qualquer um lê salas e, se a escrita também estiver aberta, altera placares ou apaga salas. |
| S3 | **O placar é calculado pelo navegador do jogador 1** e gravado por ele. O README diz que é "server-side" (`README.md:162`), o que não é verdade. | `gameLogic.js:152-167` | O jogador 1 pode gravar qualquer placar. |
| S4 | **Base64 na config do Firebase é só aparência de segurança.** A config web do Firebase é pública por natureza; quem protege o banco são as regras e o App Check. | `firebaseConfig.js`, `deploy.yml` | Complexidade sem ganho. |
| S5 | **O deploy publica o repositório inteiro** (`path: '.'`), incluindo README, `.github` e qualquer arquivo solto. | `deploy.yml:83` | Exposição desnecessária. |

### 1.2 Bugs de lógica e sincronização

| # | Bug | Onde | Cenário concreto |
|---|---|---|---|
| B1 | **Os dois clientes limpam as jogadas 3 s depois do resultado**, cada um com seu `setTimeout`. | `gameLogic.js:172-196` | O cliente A limpa e reabilita os botões. O jogador A clica logo, e o timer do cliente B, que chega alguns ms depois, apaga a jogada nova de A. A rodada trava com A esperando. |
| B2 | **Três responsáveis diferentes por uma rodada:** quem detecta as duas jogadas avança `round` (`:693-721`), o jogador 1 grava o placar (`:152`) e os dois limpam as jogadas (`:172`). | `gameLogic.js` | Se o jogador 1 estiver com a aba em segundo plano ou desconectado, o placar não é gravado e o contador de empates fica errado. |
| B3 | **Os empates são derivados** (`round - (p1 + p2)`), e `round` e `scores` são gravados em momentos diferentes. | `gameLogic.js:46` | O número de empates "pisca" com um valor errado entre um snapshot e outro. |
| B4 | **O placar aparece antes da revelação:** o listener atualiza o placar na hora (`:343-346`), mas o resultado só aparece 500 ms depois. | `gameLogic.js:343`, `:138` | O placar muda antes do "You win!". |
| B5 | **"Criar sala" pode colocar você na sala de outra pessoa.** Se o código gerado já existir com a vaga de jogador 2 livre, a transação entra nela. | `gameLogic.js:533-538`, `:586-602` | Você "cria" uma sala e cai na partida de um desconhecido. |
| B6 | **O código da sala pode ter menos de 4 caracteres:** `Math.random().toString(36).slice(2, 6)` gera `"i"` quando o número sorteado é `0.5`. | `gameLogic.js:534` | "Create New Room" mostra um `alert` de código inválido. É raro, mas acontece. |
| B7 | **Caracteres inválidos travam a tela:** só o tamanho é validado, e `.`, `#`, `$`, `[`, `]` e `/` fazem `database.ref()` lançar erro depois que a tela já mudou para "Waiting". | `gameLogic.js:542-557` | Digitar `AB.C` deixa o usuário preso no spinner. |
| B8 | **Efeitos colaterais dentro da função de transação**, que o Firebase pode executar várias vezes, a primeira delas com o cache local vazio. | `gameLogic.js:559-566` | Quem entra numa sala existente vê, por um instante, a caixa "Share this room" e fica com `isPlayer1 = true`. |
| B9 | **Saída de jogador não é confiável:** `leaveRoom` é assíncrona, faz uma leitura e só depois grava, dentro de `unload`/`pagehide`. O navegador encerra a página antes. Além disso, `unload` está obsoleto. | `gameLogic.js:862-945` | Quem fecha a aba continua como jogador 2 e a sala fica "full" para sempre, e salas abandonadas se acumulam no banco. |
| B10 | **Atualizar a página gera um novo jogador:** `playerId` é aleatório a cada carregamento. | `state.js:3` | Um F5 tira você da partida sem volta. |
| B11 | **Clique duplo registrado nos botões de jogada:** há `onclick` no HTML e também `addEventListener`. Hoje o segundo é ignorado por sorte, porque a flag `isProcessingMove` é ligada antes. | `index.html:48-53`, `elements.js:38-45` | É frágil: qualquer mudança na flag gera jogada dupla. |
| B12 | **O DOM é usado como estado** (`elements.game.style.display === "flex"`) para decidir regras de jogo. | `gameLogic.js:248`, `:922` | Qualquer mudança de CSS quebra a lógica. |
| B13 | **Pedido de reset sem controle:** quem pede não recebe retorno ("aguardando resposta"), pedidos simultâneos se sobrescrevem e não há expiração. | `gameLogic.js:738-765` | O botão parece não funcionar. |

### 1.3 Código e arquitetura

- **Arquivo-deus:** `gameLogic.js` mistura regra de jogo, acesso ao Firebase, manipulação do DOM, clipboard e ciclo de vida da página.
- **Estado espalhado:** parte fica no objeto `state`, parte na variável de módulo `lastProcessedMovesSignature` e parte no DOM.
- **Campos mortos:**
  - `lastProcessedSignature`, `lastUpdated` e `resetRequest.timestamp` são gravados no banco e nunca lidos.
  - `state.lastProcessedRound` é atualizado e nunca usado.
- **Firebase compat 9.6.0 (2021)** carregado como global por CDN e misturado com ES modules: `firebase.*` é usado de forma implícita dentro dos módulos.
- **Falta de padrão:**
  - Para erros, uns usam `alert()` (`:544`, `:731`, `:762`, `:827`) e outros, o toast.
  - Para mostrar e esconder, uns usam `style.display` e outros, o atributo `hidden`, às vezes os dois.
- **Programação defensiva sem coerência:** `verifyElements()` lança erro se faltar um elemento, mas o resto do código continua testando `if (elements.x)`.
- **JSDoc que não bate com o código:** documenta parâmetros inexistentes (`:20-23`).
- **Nenhum teste e nenhuma tipagem.**

### 1.4 Interface e acessibilidade

- **Contraste abaixo de 4,5:1 (WCAG AA) no texto branco dos botões:**

  | Botão | Contraste |
  |---|---|
  | Azul `#4285F4` | 3,56 |
  | Verde `#0F9D58` | 3,51 |
  | Vermelho `#DB4437` | 4,29 |
  | Copiar `#2196f3` | 3,12 |
  | "Waiting" (laranja sobre pêssego) | 2,13 |

- **O resultado não é anunciado a leitores de tela:** `#result` não é `aria-live` (`index.html:62`).
- **`aria-label` sem efeito:** está em `<span>` sem papel definido, como placar e escolhas, e leitores de tela ignoram.
- **Duas `<main>`** com `role="main"` redundante (`index.html:14`, `:45`).
- **Modal de reset incompleto:** não move o foco, não prende o foco nem fecha com Esc. A solução é usar `<dialog>`.
- **Foco em todo clique:** `*:focus` mostra contorno até em clique de mouse; o certo é `:focus-visible`.
- **Sem saída:** não há botão para sair da sala, nem na espera nem no jogo.
- **Sem link de convite:** é preciso ditar o código, não há `?sala=ABCD` nem Web Share no celular.
- **Sem tema escuro e sem tokens de cor**, apesar de o README dizer que usa "custom properties".
- **Layout:** `body { height: 90vh }` é um valor arbitrário.
- **Idioma:** a interface está em inglês, num jogo chamado "Jokenpô" e feito para um público brasileiro.

### 1.5 Documentação e repositório

- **O README não confere com o código:**
  - Lista `scripts.js` (`:56`), que foi apagado.
  - Diz que o placar é calculado no servidor (`:162`).
  - Promete navegação por teclado (`:188`).
  - Linka um `LICENSE` (`:210`) que não existe.
- **Faltam arquivos:** `.gitignore` sem `node_modules`/`dist`, sem `CLAUDE.md` e sem `firebase.json`/`database.rules.json` versionados.

---

## 2. Arquitetura alvo

Segue o padrão do `simulador-brasileirao-2026`: **Vite + TypeScript estrito + Vitest + Preact**.

```
jokenpo/
├── database.rules.json            # regras versionadas e testadas no emulador
├── firebase.json
├── index.html
├── src/
│   ├── domain/                    # puro: sem Firebase, sem DOM, sem Date.now()
│   │   ├── types.ts               # Move, PlayerSlot, RoundRecord, MatchSummary, RoomCode…
│   │   ├── rules.ts               # resolveRound(a, b) → 'player1' | 'player2' | 'tie'
│   │   ├── match.ts               # summarize(rounds) → placar, empates, rodada atual, fase
│   │   ├── roomCode.ts            # gerar/validar código (alfabeto sem 0/O/1/I/L)
│   │   └── commitment.ts          # verificação de commit-reveal (hash injetado)
│   ├── application/               # casos de uso; depende de domain e de portas
│   │   ├── ports.ts               # RoomGateway, Identity, Hasher, Clock
│   │   ├── createRoom.ts
│   │   ├── joinRoom.ts
│   │   ├── playMove.ts            # commit → reveal
│   │   ├── resetMatch.ts          # pedir / aceitar / recusar
│   │   ├── leaveRoom.ts
│   │   └── gameSession.ts         # junta snapshot + domínio → GameViewModel
│   ├── infrastructure/            # implementa as portas
│   │   ├── firebase/client.ts     # SDK modular v11+, config via import.meta.env
│   │   ├── firebase/roomGateway.ts# DTO do banco ↔ tipos do domínio
│   │   ├── firebase/presence.ts   # onDisconnect()
│   │   ├── firebase/identity.ts   # Auth anônima (uid persistente)
│   │   ├── webCryptoHasher.ts
│   │   └── clipboard.ts
│   ├── ui/
│   │   ├── App.tsx                # renderiza a partir do view model, sem show/hide manual
│   │   ├── screens/HomeScreen.tsx, WaitingScreen.tsx, GameScreen.tsx
│   │   ├── components/MoveButton.tsx, Scoreboard.tsx, ConfirmDialog.tsx, Toast.tsx
│   │   ├── i18n/pt-BR.ts
│   │   └── styles/tokens.css, app.css
│   └── main.tsx
└── test/
    ├── architecture.test.ts       # domain não importa nada externo, etc.
    ├── rules.test.ts / match.test.ts / roomCode.test.ts / commitment.test.ts
    ├── gameSession.test.ts        # com gateway em memória
    └── firebase-rules.test.ts     # @firebase/rules-unit-testing no emulador
```

**Regra das camadas** (garantida por `architecture.test.ts`, como no simulador):

| Camada | Pode importar |
|---|---|
| `domain` | só `domain` |
| `application` | `domain`, `application` |
| `infrastructure` | `domain`, `application/ports` |
| `ui` | `application`, `domain/types` |

O `main.tsx` é o único ponto que conecta a infraestrutura aos casos de uso (composition root).

**Por que Preact e não JS puro:** a maior fonte de bugs de interface hoje é mostrar e esconder telas manualmente (B12, o display com hidden duplicado). Renderizar a partir de um `GameViewModel` resolve isso de forma estrutural. Além disso, é o mesmo stack do simulador.

---

## 3. Novo modelo de dados

O modelo atual guarda `scores`, `round`, `move` e `resultProcessed`, e cada campo é atualizado por um cliente diferente em momentos diferentes. O modelo novo guarda **fatos imutáveis**; placar, empates e rodada atual passam a ser **calculados** a partir deles, por funções puras do domínio.

```
rooms/{code}
  createdAt
  players/
    player1: { uid, connected, seenAt, joinedAt }
    player2: { uid, connected, seenAt, joinedAt }
  matches/{matchId}                 # reset = nova partida; histórico preservado
    rounds/{n}/
      player1: { commit, reveal?: { move, nonce } }
      player2: { commit, reveal?: { move, nonce } }
  currentMatch: matchId
  resetRequest?: { by, at }
```

**Commit-reveal:** resolve a trapaça (S1) sem Cloud Functions, que exigiriam o plano pago Blaze.

1. Cada jogador grava `commit = SHA-256(move + nonce)`. O adversário não consegue saber a jogada a partir do hash.
2. As regras só permitem gravar `reveal` quando os dois `commit` já existem.
3. Cada cliente confere `hash(reveal) === commit` do adversário. Se não bater, ou se o adversário não revelar dentro de um prazo, a rodada é perdida por W.O.

**O que esse modelo elimina:**

- **B1, B2, B3 e B4:** ninguém "limpa" jogada nem "grava placar". A rodada `n+1` é simplesmente um novo nó.
- **S3:** o placar é `summarize(rounds)`, igual nos dois clientes, sem um "dono" que possa alterá-lo.
- **Reset (B13):** vira "criar nova partida" sem apagar nada, o que de quebra dá histórico de partidas.

**Regras do banco (`database.rules.json`):**

- Exige `auth != null` (Auth anônima, invisível para o usuário).
- Proíbe listar `rooms`; só é possível ler a sala pelo código.
- Cada `uid` só escreve no próprio slot; `commit` só pode ser gravado uma vez; `reveal` só depois dos dois commits.
- Valida formato: código `^[A-HJKMNP-Z2-9]{4}$`, `move` entre os três valores e tamanho do hash.
- Só troca `currentMatch` (nova partida) quem aceita o pedido de reset do outro, ou quem está sozinho na sala.
- Opcional: App Check com reCAPTCHA Enterprise, contra scripts fora do site.

**Presença (B9, B10):**

- `onDisconnect()` grava `connected: false` e `seenAt` no servidor quando a conexão cai, sem depender de `unload`.
- O `uid` anônimo persiste no navegador, então atualizar a página reconecta ao mesmo slot.
- O adversário vê "Oponente desconectado…". Depois de 60 s desconectado, qualquer pessoa pode liberar o slot, e isso é garantido pelas regras.
- Salas antigas: sem Functions não há limpeza agendada, mas as regras podem permitir que qualquer cliente apague salas com `createdAt` de mais de 24 h, e a criação de uma nova sala faz essa faxina oportunista.

---

## 4. Plano por fases

Cada fase termina com algo publicável.

A antiga Fase 0, uma correção emergencial no código atual, foi descartada: a reescrita substitui as regras do banco e o SDK do Firebase. Login anônimo e regras do banco entram no início da Fase 1. Enquanto isso, a única ação recomendada é verificar no console do Firebase se o projeto está no plano Spark ou no Blaze. Se estiver no Blaze, configurar um alerta de orçamento.

### Fase 1: fundação + segurança (≈1 dia) ✅ concluída em 06/11/2026, na branch `reescrita`

- [x] Ativar Auth anônima no console do Firebase.
- [x] Escrever `database.rules.json` para o modelo novo (seção 3) e versioná-lo com `firebase.json`. São 29 testes no emulador, em `test/emulator/database.rules.test.ts`.
- [x] Configurar o emulador do Firebase para desenvolvimento local (`npm run dev:emulators`) e para os testes de integração (`npm run test:emulator`).
- [x] Vite + TypeScript estrito + Vitest + Preact, com `tsconfig` igual ao do simulador.
- [x] Firebase SDK modular via npm; remover os `<script>` de CDN.
- [x] Config via `VITE_FIREBASE_*`, eliminando o placeholder `@@FIREBASE_CONFIG@@`, o base64 e o script Node do workflow.
- [x] Ajustar o workflow: testes em todo push e PR; build e deploy de `dist/` só na `main`.
- [x] Criar `test/architecture.test.ts` e as pastas das camadas.
- [x] Atualizar o `.gitignore` com `node_modules`, `dist` e `.env.local`.
- [x] Mover o código antigo para `legacy/`, como referência até a Fase 4. A pasta será apagada no fim da reescrita.

**Atenção:** as regras novas **não** devem ir para produção antes de o app novo ser publicado. Elas rejeitam o formato de dados do app atual e o quebrariam. O deploy das regras (`npx firebase deploy --only database`) acontece junto com o merge da reescrita na `main`.

### Fase 2: domínio com testes (≈½ dia)

- [ ] `types.ts`: `Move`, `PlayerSlot`, `RoundRecord`, `MatchSummary`, `RoomCode` (tipo nominal).
- [ ] `rules.ts`: `resolveRound`, com tabela de vitórias tipada (`Record<Move, Move>`).
- [ ] `match.ts`: `summarize(rounds)` → `{ scores, ties, currentRound, phase, lastResult }`.
- [ ] `roomCode.ts`: `generate(random)`, com aleatoriedade injetada para teste, e `parse(input)` → `RoomCode | erro`.
- [ ] `commitment.ts`: `verifyReveal(commit, reveal, hasher)`.
- [ ] Testes cobrindo as 9 combinações de jogada, rodada incompleta, reveal inválido, W.O. e normalização do código.

### Fase 3: aplicação e infraestrutura (≈1 dia)

- [ ] `ports.ts` com `RoomGateway` (create, join, subscribe, commit, reveal, requestReset, respondReset, leave).
- [ ] Casos de uso:
  - `createRoom`: tenta códigos até achar um livre, usando uma transação que **aborta** se o código existir (corrige B5 e B6).
  - `joinRoom`: valida antes de mudar de tela (corrige B7).
  - `playMove`, `resetMatch` e `leaveRoom`.
- [ ] `gameSession.ts`: snapshot → `GameViewModel` (fase, placar, botões habilitados, mensagens). Testado com gateway em memória.
- [ ] `firebase/roomGateway.ts`: mapeamento entre DTO e domínio; nada de efeito colateral dentro de `runTransaction` (B8).
- [ ] `presence.ts` com `onDisconnect`, `identity.ts` com uid persistente e `webCryptoHasher.ts`.
- [ ] `firebase-rules.test.ts` no emulador: não lê o slot alheio, não reescreve o commit, não revela antes da hora.

### Fase 4: interface (≈1 dia)

- [ ] Telas Início, Esperando e Jogo renderizadas a partir do view model; sem `style.display` manual.
- [ ] Interface em pt-BR por padrão, com seletor de inglês:
  - textos em `i18n/pt-BR.ts` e `i18n/en.ts`, com o mesmo tipo de chaves;
  - a escolha fica salva no `localStorage`;
  - o `lang` do `<html>` acompanha o idioma escolhido.
- [ ] Tokens de cor em `:root`, tema escuro com `prefers-color-scheme` e contraste ≥ 4,5:1 em todo texto.
- [ ] `ConfirmDialog` com `<dialog>` nativo (foco, Esc, `aria-modal`); toasts no lugar de todos os `alert()`.
- [ ] Região `aria-live` para o resultado da rodada; `:focus-visible`; uma única `<main>`.
- [ ] Botão "Sair da sala" na espera e no jogo; aviso "aguardando resposta" ao pedir reset, com opção de cancelar.
- [ ] Link de convite `?sala=ABCD`, com entrada automática ao abrir, mais Web Share API no celular e cópia como alternativa.
- [ ] Animação curta de revelação ("Jo… Ken… Pô!") respeitando `prefers-reduced-motion`.

### Fase 5: funcionalidades novas (opcional, escolher)

- [ ] **Melhor de 3/5/7**, com tela de vencedor e "revanche".
- [ ] **Histórico das rodadas** da partida (é só renderizar `rounds`).
- [ ] **Apelidos** dos jogadores.
- [ ] **Modo contra o computador**, sem Firebase, reaproveitando o domínio. Também serve para testar a interface sem banco.
- [ ] **Indicador "oponente está online/digitando"**, aproveitando a presença.
- [ ] **PWA** (instalável e com ícone).

### Fase 6: documentação

- [ ] README em pt-BR, fiel ao código: arquitetura, modelo de dados, como rodar com o emulador do Firebase.
- [ ] Adicionar `LICENSE` (MIT) ou remover o link.
- [ ] `CLAUDE.md` com as regras de camadas e os comandos.

---

## 5. Decisões

**Tomadas em 06/11/2026:**

- **Anti-trapaça:** commit-reveal, no plano gratuito, sem Cloud Functions.
- **Idioma:** pt-BR por padrão, com opção de inglês.
- **Hospedagem:** GitHub Pages por enquanto. Migrar para Cloudflare ou Vercel será avaliado no fim.
- **Fase 0:** descartada. Login e regras entram na Fase 1.

**Em aberto:**

1. **Stack de UI:** a recomendação é Preact, igual ao simulador. A alternativa é TypeScript puro com funções `render(viewModel)`; é mais leve, mas tem mais código manual.
2. **Escopo da Fase 5:** quais funcionalidades entram.

## 6. Ordem sugerida

Fases 1, 2 e 3 em sequência; a 2 pode começar em paralelo com a 1, porque o domínio não depende de nada. Depois a 4 e a 6, por fim avaliar a hospedagem. A 5 fica sob demanda.
