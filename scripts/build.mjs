import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');
const [template, css, scene, cosmos, artifacts, app] = await Promise.all(['index.html','src/styles.css','src/world.js','src/cosmos.js','src/project-artifacts.js','src/app.js'].map(read));
// Source-only font imports occupy a complete line. Strip the whole line:
// a font URL can itself contain semicolons, which are not rule terminators.
const styles = css.replace(/^[\t ]*@import[^\r\n]*;[\t ]*(?:\r?\n|$)/gm, '');
if (/@import\b/i.test(styles)) throw new Error('Keep source-only CSS imports on a single line before building.');
const inlineModule = (source, name) => `const { ${name} } = (() => {\n${source.replace(/^export\s+/gm, '')}\nreturn { ${name} };\n})();`;
const script = inlineModule(scene, 'World') + '\n' + inlineModule(cosmos, 'Cosmos') + '\n' + inlineModule(artifacts, 'ProjectArtifacts') + '\n' + app.replace(/^import\s+.*from\s+['"].*['"];?\s*$/gm, '');
if (/<\/script/i.test(script)) throw new Error('An inline script terminator must be escaped before bundling.');
// Illustrations ship inside the single file as data URIs; the dev server keeps serving the files.
const inlineIllustrations = async (html) => {
  const matches = [...html.matchAll(/\.\/assets\/illustrations\/([\w-]+\.webp)/g)].map(m => m[1]);
  let out = html;
  for (const file of [...new Set(matches)]) {
    const bytes = await readFile(path.join(root, 'assets/illustrations', file));
    out = out.split(`./assets/illustrations/${file}`).join(`data:image/webp;base64,${bytes.toString('base64')}`);
  }
  return out;
};
const output = (await inlineIllustrations(template))
  // Function replacers: a literal "$'" or "$&" inside the sources must not be
  // interpreted as a replacement pattern.
  .replace('<link rel="stylesheet" href="./src/styles.css">', () => `<style>\n${styles}\n</style>`)
  .replace('<script type="module" src="./src/app.js"></script>', () => `<script type="module">\n${script}\n</script>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/index.html'), output);
await cp(path.join(root, 'dist/index.html'), path.join(root, 'AXO-World.html'));
console.log(`Built an offline-ready standalone website (${Math.round(Buffer.byteLength(output)/1024)} KB).`);
