This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Capas de cursos e miniaturas de aulas

Execute `db/2026-10-05-capas-cursos-aulas.sql` no SQL Editor do Supabase. A migração é repetível, mantém os cursos e aulas existentes e cria o bucket público `capas` com PNG/JPG/WebP de até 2 MB, sem liberar gravação anônima.

Configure `SUPABASE_SERVICE_ROLE_KEY` somente no servidor: no `.env.local` para desenvolvimento e nas variáveis de ambiente do projeto Vercel para produção. Use a chave privada do mesmo projeto Supabase de `NEXT_PUBLIC_SUPABASE_URL`. Nunca coloque essa chave em uma variável `NEXT_PUBLIC_*`, no Git ou em mensagens. Reinicie o servidor local após configurar a variável; produção precisa de novo deploy para carregá-la.

Professor: capa opcional ao criar/editar curso; miniatura personalizada no editor de cada aula, com opção de voltar à automática do vídeo. Aluno: porcentagem real e barra sobre a capa, com miniaturas por aula. URLs de envio são assinadas apenas após verificar autenticação e acesso; imagens são validadas no servidor antes de gravar o caminho.
