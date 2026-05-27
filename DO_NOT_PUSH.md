# DO NOT PUSH

Never commit or push:

- `.env`, `.env.local`, `.env.*.local`
- Files with `secret`, `credentials`, `token`, `api_key`, or `private_key` in the name
- `.pem`, `.p12`, `.pfx`, `.crt`, `.key`
- `node_modules/`
- Playwright reports and test result folders
- Local screenshots, scratch files, or personal notes
- Unreviewed Google Drive exports
- Build outputs, caches, and logs

Before push:

```bash
git status --short
git ls-files | findstr /i ".env secret credential token private_key"
```

If a secret was committed, rotate it before rewriting history.
