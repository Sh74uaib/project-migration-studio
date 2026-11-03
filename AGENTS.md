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
- Keep sector chat in a dedicated controlled sheet component with per-sector in-memory conversations; this isolates the UI-first demo from future live news and AI integration.
- The /feed page builds sector articles client-side (search → AI rewrite to JSON) and caches them per sector per Dhaka day in localStorage; this keeps the no-backend architecture.
