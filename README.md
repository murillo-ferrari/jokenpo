# Jokenpô Online

Pedra, papel e tesoura com um amigo, em tempo real, ou contra o computador. Sem cadastro: cria a sala, manda o link e joga.

**Jogar:** https://murillo-ferrari.github.io/jokenpo

## Funcionalidades

- **Partida online por código ou link**: quem cria a sala recebe um código de 4 caracteres (sem 0/O, 1/I/L, para não confundir ao ditar) e um link de convite `?sala=AB23`, que no celular abre o compartilhamento nativo.
- **Sem trapaça**: cada jogada é publicada primeiro só como um hash (*commit-reveal*). Ninguém vê a jogada do outro antes de escolher, e ninguém troca de jogada depois de ver a do outro.
- **Formatos**: partida livre ou melhor de 3, 5 ou 7 (empates não contam), com tela de vencedor e revanche.
- **Prazo para escolher**: quando um jogador escolhe, o outro tem 5, 10 ou 15 s (definido ao criar a sala) para escolher, com contagem na tela e bipe nos últimos segundos. Se o tempo acabar, perde a rodada por W.O.
- **Contra o computador**: funciona sem internet, sem prazo.
- **Placar sempre igual para os dois**: não é gravado em lugar nenhum, é calculado a partir das rodadas.
- **Recomeçar a partida** com aceite do adversário, **apelidos** opcionais, **histórico** das rodadas e indicador de **presença** (online/desconectado).
- **Volta para a partida depois de um F5**, inclusive no meio de uma rodada.
- **pt-BR e inglês**, **tema claro e escuro** (segue o sistema), **acessível** (leitor de tela, teclado, contraste AA, sem animação para quem pede menos movimento) e **instalável** (PWA).

## Como jogar

1. Escolha o formato e o tempo para escolher e clique em **Criar sala**.
2. Mande o link ou o código para quem vai jogar com você.
3. Quando a outra pessoa entrar, escolham **Pedra**, **Papel** ou **Tesoura**. A jogada do adversário só aparece depois da contagem "Jo… Ken… Pô!".

## Tecnologia

- **Front-end**: [Preact](https://preactjs.com/) + TypeScript (modo estrito), empacotado com [Vite](https://vite.dev/).
- **Tempo real**: Firebase Realtime Database, com login anônimo (Firebase Auth).
- **Testes**: [Vitest](https://vitest.dev/), Testing Library com happy-dom e o emulador do Firebase para regras do banco e integração.
- **Hospedagem**: GitHub Pages, com deploy pelo GitHub Actions.

## Arquitetura

O código é separado em quatro camadas. Um teste (`test/architecture.test.ts`) falha se alguma camada importar o que não deve.

| Camada | O que tem | Pode importar |
|---|---|---|
| `src/domain/` | Regras puras: quem vence, commit-reveal, placar, prazos, código da sala, apelido. Sem Firebase, DOM ou relógio. | Só `domain` |
| `src/application/` | Casos de uso (criar/entrar/jogar/recomeçar/sair) e o `GameSession`, que transforma a sala no que a tela mostra. | `domain`, `application` |
| `src/infrastructure/` | Firebase (gateway, presença, relógio do servidor), navegador (`localStorage`, aleatoriedade) e salas em memória com o adversário-computador. | `domain`, `application/ports.ts` |
| `src/ui/` | Telas e componentes Preact, textos (`i18n/`), estilos (`styles/`). | `domain/types.ts`, `application`, `ui` |

`src/main.tsx` e `src/computerGame.ts` são os únicos pontos que ligam tudo (composition root).

### Modelo de dados

```
rooms/{código}
  createdAt, bestOf, choiceSeconds, currentMatch
  players/player1|player2: { uid, name?, seenAt, joinedAt, connections: { [id]: true } }
  matches/{partida}/rounds/{n}/player1|player2: { commit, at, reveal?: { move, nonce, at } }
  resetRequest?: { by, at }
```

- **Uma conexão por aba**: o jogador está conectado enquanto houver alguma conexão; a queda de uma aba é registrada pelo próprio servidor (`onDisconnect`).
- **Recomeçar = nova partida** (`currentMatch`): o histórico fica, o placar zera.
- **Prazos com o horário do servidor**: 5, 10 ou 15 s para escolher, 5 s para revelar e 60 s sem conexão para liberar a vaga. Por isso o relógio do celular não interfere, e um resultado mostrado nunca muda depois.

As regras do banco (`database.rules.json`) garantem tudo isso do lado do servidor:
- só quem está logado acessa uma sala, e ninguém lista as salas;
- cada um escreve só na própria vaga;
- o commit e o reveal são gravados uma única vez, e o reveal só depois dos dois commits;
- todo horário tem de ser o do servidor;
- o formato da partida e o tempo para escolher não mudam depois que a sala é criada;
- só o adversário pode aceitar um pedido para recomeçar.

## Rodando localmente

**Requisitos:**
- **Node.js 24.**
- **Java 21:** usado pelo emulador do Firebase. No macOS, baixe o instalador `.pkg` em [adoptium.net](https://adoptium.net/temurin/releases/?version=21); se usa Homebrew, `brew install openjdk@21` também funciona, mas exige ajustar o `PATH`.

```bash
npm install
cp .env.example .env.local      # já vem com VITE_USE_EMULATORS=true
npm run dev:emulators           # terminal 1: emuladores de Auth e Database (projeto demo, sem credenciais)
npm run dev                     # terminal 2: http://127.0.0.1:5173/jokenpo/
```

A interface do emulador fica em http://127.0.0.1:4000.

Para simular dois jogadores no mesmo navegador, abra uma aba em `127.0.0.1` e outra em `localhost` (ou use uma janela anônima): abas da mesma origem compartilham o login e viram o mesmo jogador.

Para apontar para um projeto real do Firebase, preencha as variáveis `VITE_FIREBASE_*` no `.env.local` e use `VITE_USE_EMULATORS=false`.

## Testes

```bash
npm run typecheck      # TypeScript
npm test               # unitários, de sessão, de interface, de contraste e de arquitetura
npm run test:emulator  # regras do banco e integração com o Firebase (precisa de Java)
npm run build          # checagem de tipos + build de produção em dist/
```

## Deploy

O workflow `.github/workflows/deploy.yml` roda os testes em todo push e pull request. Na `main`, ele também faz o build e publica `dist/` no GitHub Pages.

**Segredos necessários** em *Settings → Secrets and variables → Actions*:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

**As regras do banco não são publicadas pelo workflow:**

```bash
npx firebase login
npx firebase deploy --only database --project <id-do-projeto>
```

Publique as regras junto com a versão do app que as usa: regras e app dependem do mesmo formato de dados.

**No console do Firebase**, ative o **login anônimo** em *Authentication → Sign-in method*.

## Documentação

- `docs/plano-melhoria-jokenpo.md`: revisão do projeto original, decisões e histórico da reescrita.

## Licença

[MIT](LICENSE) © Murillo Ferrari
