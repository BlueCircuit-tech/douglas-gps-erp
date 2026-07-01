# Contribuindo — BlueCircuit-tech

## Fluxo de branches

- **`main`** — produção. **Não faça push direto.** Só entra via Pull Request aprovado.
- **`staging`** — integração. É aqui que os devs sobem o trabalho do dia a dia.
- **feature branches** (opcional) — `feat/...`, `fix/...`, criadas a partir de `staging`.

> ⚠️ A organização está no plano **free**, então a `main` **não é travada pelo sistema** — é uma **regra combinada** do time: ninguém faz push direto na `main`; tudo entra via PR com review de um owner. (Se um dia migrar para o GitHub Team, isso passa a ser enforçado automaticamente.)

## Passo a passo

1. Atualize a `staging`: `git checkout staging && git pull`
2. (Opcional) crie sua branch: `git checkout -b feat/minha-mudanca`
3. Faça os commits.
4. Suba: `git push origin staging` (ou a sua branch).
5. Abra um **Pull Request apontando para a `main`**.
6. Espere o **CI ficar verde** e o **review aprovado** de um owner.
7. Faça o merge.

## Regras

- **Nunca** commite segredos. Configure o `.env` (que é ignorado pelo git) a partir do `.env.example`.
- Rode o projeto localmente antes de abrir o PR (veja o `README.md`).
- Use commits descritivos: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`…

## Rodando localmente

Veja o `README.md` do projeto para instalação, configuração do `.env`, `dev` e `build`.
