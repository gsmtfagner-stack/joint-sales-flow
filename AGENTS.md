<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- Access is a shared-password gate (`SITE_PASSWORD` + encrypted session cookie in `src/lib/gate.server.ts`), not per-user auth — the two operators share one login.
- All data access goes through gated server functions in `src/lib/data.functions.ts` using the service-role client; tables have RLS on with no public policies, so the browser never queries the database directly.
