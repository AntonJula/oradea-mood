import { openRouter } from '../lib/classification.mjs';

try {
  const [result] = await openRouter({ key: process.env.OPENROUTER_API_KEY, model: process.env.AI_MODEL })([
    { id: 1, text: 'Sunt relaxat și mă bucur de liniște în seara asta.' },
  ]);
  console.log('Clasificare de probă:', result);
  if (!result.eligible || result.mood !== 'relaxat') process.exitCode = 1;
} catch (error) {
  console.error('Proba OpenRouter a eșuat:', /^OpenRouter HTTP \d+$/.test(error.message) ? error.message : (process.env.OPENROUTER_API_KEY ? 'verifică conexiunea și modelul configurat.' : 'OPENROUTER_API_KEY lipsește.'));
  process.exitCode = 1;
}
