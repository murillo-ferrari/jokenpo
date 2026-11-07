# CLAUDE.md — Jokenpô Online

Pedra, papel e tesoura multiplayer em tempo real (Preact + TypeScript + Firebase Realtime Database), mais modo contra o computador offline. Publicado no GitHub Pages em `/jokenpo/`. Responda e escreva textos de interface, docs e commits em **português do Brasil**, com acentuação correta. Identificadores de código em inglês (padrão existente).

## Antes de tudo

- **Commit e push só com confirmação explícita do usuário, a cada vez.** Aprovação de um commit não vale para o próximo.
- Histórico, decisões e pendências: `docs/plano-melhoria-jokenpo.md` (seção 4 = fases; "Correções após teste manual" = decisões de UX). Leia só a seção necessária.
- `src/ui/styles/app.css` é grande: use `Grep` pelo seletor antes de ler.

## Comandos

```sh
npm run dev:emulators   # emuladores Auth + Database (projeto demo-jokenpo; precisa de Java 21)
npm run dev             # Vite; use VITE_USE_EMULATORS=true (no .env.local ou na linha de comando)
npm run typecheck
npm test                # unitários, sessão, UI (happy-dom), contraste, arquitetura
npm run test:emulator   # regras do banco + integração (sobe os próprios emuladores)
npm run build
```

Antes de dar uma tarefa por concluída: `npm run typecheck && npm test && npm run build`. Se mexeu em regras do banco, gateway do Firebase ou presença: também `npm run test:emulator`. Se os emuladores já estiverem rodando (portas 9000/9099), rode `npx vitest run --config vitest.emulator.config.ts` em vez de `test:emulator`.

## Camadas (`src/`) — o teste `test/architecture.test.ts` faz valer

| Pasta | Regra |
|---|---|
| `domain/` | **Puro e testado.** Regras do jogo, commit-reveal, placar (`summarize`), prazos, código da sala, apelido. Sem Firebase, Preact, DOM ou `Date.now()`: horário e aleatoriedade entram por parâmetro. Regra nova de negócio entra aqui, com teste. |
| `application/` | Casos de uso + `GameSession` (estado da sala → `GameView`, ações automáticas). Fala com o mundo só pelas portas de `ports.ts`. |
| `infrastructure/` | Implementa as portas: `firebase/` (gateway, mapper, presença, relógio do servidor), `browser/`, `local/` (salas em memória + `ComputerOpponent`). Importa só `domain` e `application/ports.ts`. |
| `ui/` | Preact. Importa `application` e **só `domain/types.ts`** do domínio. Textos sempre via `useI18n()` (`i18n/pt-BR.ts` e `en.ts`, mesmo tipo `Messages`). |
| `main.tsx`, `computerGame.ts` | Composition root: únicos lugares que instanciam infraestrutura. |

## Regras inegociáveis

- **O placar nunca é gravado**: é sempre `summarize(rounds)`. Resultado de rodada concluída depende só dos dados gravados (horários do servidor), nunca de `now`.
- **Jogada aberta nunca vai para o banco antes dos dois commits.** A jogada e o nonce ficam no `SessionStore` *antes* de publicar o commit (sobrevive a F5).
- **Constantes duplicadas entre código e `database.rules.json` precisam bater** (há testes cruzados para algumas): alfabeto do código (`ROOM_CODE_ALPHABET`), 60 s de vaga abandonada (`STALE_PLAYER_MS`), `bestOf` 0/3/5/7, `choiceSeconds` 5/10/15, apelido ≤ 20 caracteres no domínio (≤ 40 unidades UTF-16 nas regras), formatos de hash (64 hex) e nonce (32 hex).
- **Regras do banco mudam junto com o app**: mudou o formato de dados → atualize `database.rules.json`, os testes em `test/emulator/` e o mapper. As regras são publicadas à mão (`npx firebase deploy --only database`) e **junto** com o deploy do app.
- **Presença é por conexão** (`players/{vaga}/connections/{id}`): nunca volte a um campo único `connected`.
- **Sem `alert()`, sem `innerHTML`.** Avisos viram `Notice` → toast; erros de formulário ficam junto do campo.
- **Sem `else if`**: prefira retornos antecipados ou extrair uma função pura (preferência do usuário).
- **Contraste**: cor nova de texto vai em `tokens.css` (claro e escuro) e no `test/contrast.test.ts`.
- **Layout estável (CLS)**: elementos que mudam de conteúdo têm espaço reservado (cartão da rodada, status, área de jogada, histórico). Não introduza nada que apareça/suma empurrando a tela.

## Decisões de UX já tomadas (não reabrir sem o usuário pedir)

- Cartão do centro mostra a **rodada atual** ("?" / minha jogada / "✓" do adversário) → contagem "Jo… Ken… Pô!" (placar congelado) → resultado por 2,5 s → próxima rodada. W.O. por não escolher pula a contagem.
- Prazo para escolher definido na criação da sala (5/10/15 s, padrão 15); reta final = metade do prazo, máx. 5 s, vermelha e com bipe só para quem precisa escolher; 2 últimos bipes agudos. Contra o computador não há prazo.
- Resultado fora do normal = etiqueta curta na linha do resultado ("por W.O.", "jogada inválida", "anulada"), explicação no tooltip.
- Histórico com no máximo 5 rodadas visíveis (rolagem), com seta de abrir/fechar.
- Campo do código: 4 caracteres, maiúsculas, sem espaços/hífens (limpo ao digitar; sem `maxLength`).
- Ícone "Ciclo" (pedra/papel/tesoura como objetos com setas); favicon é a versão simplificada, usada também no cabeçalho.
- pt-BR padrão, inglês opcional; tema segue o sistema.

## Testes — como o usuário espera

- Teste novo para cada caminho reescrito ou corrigido; quando o teste é de regressão, confira que ele **falha** com o código antigo (mutação) antes de dar por resolvido.
- `test/support/fakeServer.ts` usa o servidor em memória de produção (`infrastructure/local/memoryRooms.ts`) com relógio controlado.
- Testes de emulador que criam salas usam código sorteado (podem rodar de novo contra emuladores já ligados).
