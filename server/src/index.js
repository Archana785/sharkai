import { config } from './config.js';
import { createApp } from './app.js';
import { llmHealth } from './services/llm.js';
import { ollamaHealth } from './services/ollama.js';
import { initStore } from './lib/store.js';

createApp().listen(config.port, async () => {
  console.log(`SharkAI listening on port ${config.port}. Open it from another device at http://<this computer's IP>:${config.port}`);
  // Open storage now, so a wrong DATABASE_URL shows up in the logs at startup instead of on the first sign-up.
  initStore().then(
    () => console.log(config.databaseUrl ? 'Storage: Postgres (DATABASE_URL). Accounts and reports survive redeploys.' : `Storage: JSON file in ${config.dataDir}. A free host wipes this on redeploy, so set DATABASE_URL to keep accounts.`),
    (err) => console.error(`! Could not open storage: ${err.message}. Check DATABASE_URL.`)
  );
  const h = await llmHealth();
  if (!config.providers.length) console.warn('! No AI is set up. Add GROQ_API_KEY (and AI_PROVIDER=groq,gemini) to the server settings. Ollama is never used unless you write "ollama" in AI_PROVIDER.');
  console.log(`AI order: ${(h.chain || [`ollama (${h.model})`]).join('  ->  ')}`);
  for (const name of config.skippedProviders) console.warn(`! "${name}" is listed in AI_PROVIDER but has no API key (${name.toUpperCase()}_API_KEY). It is skipped.`);
  if (config.providers.some((p) => p.kind === 'ollama')) {
    const o = await ollamaHealth();
    if (o.ollama === 'down') console.warn(`! Ollama is not reachable at ${config.ollamaHost}. Start it with: ollama serve`);
    else if (!o.modelInstalled) console.warn(`! Model "${o.model}" is not installed. Run: ollama pull ${o.model}`);
    else console.log(`Ollama is up (model ${o.model}).`);
  }
});