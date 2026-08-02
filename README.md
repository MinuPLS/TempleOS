# TempleOS frontend

## Shared archive deployment

Archive views load their data from the public R2 manifest configured through
`VITE_DATA_MANIFEST_URL`. See [the Cloudflare archive Worker](./cloudflare-archive-worker/README.md)
for the D1/R2 setup, cutover seeding, and seven-day parallel validation process.

The GitHub snapshot workflow and committed `public/*.json` files remain in place
until that validation is complete. Do not deploy this frontend with the new
archive hooks until `VITE_DATA_MANIFEST_URL` points at the seeded R2 manifest.

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
