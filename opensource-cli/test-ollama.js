import OpenAI from 'openai';

async function test() {
  console.log("Testing Ollama API connection...");
  
  // Test 1: fetch tags using localhost
  try {
    console.log("1. Fetching /api/tags using localhost...");
    const t0 = Date.now();
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    console.log(`   Success in ${Date.now() - t0}ms! status:`, res.status);
    const data = await res.json();
    console.log("   Models found:", data.models?.map(m => m.name));
  } catch (err) {
    console.error("   Localhost failed:", err.message);
  }

  // Test 2: fetch tags using 127.0.0.1
  try {
    console.log("2. Fetching /api/tags using 127.0.0.1...");
    const t0 = Date.now();
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    console.log(`   Success in ${Date.now() - t0}ms! status:`, res.status);
    const data = await res.json();
    console.log("   Models found:", data.models?.map(m => m.name));
  } catch (err) {
    console.error("   127.0.0.1 failed:", err.message);
  }

  // Test 3: OpenAI client using localhost
  try {
    console.log("3. Testing OpenAI chat completions using localhost...");
    const openai = new OpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' });
    const t0 = Date.now();
    const response = await openai.chat.completions.create({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10,
    });
    console.log(`   Success in ${Date.now() - t0}ms!`, response.choices[0].message.content);
  } catch (err) {
    console.error("   OpenAI localhost failed:", err.message);
  }

  // Test 4: OpenAI client using 127.0.0.1
  try {
    console.log("4. Testing OpenAI chat completions using 127.0.0.1...");
    const openai = new OpenAI({ baseURL: 'http://127.0.0.1:11434/v1', apiKey: 'ollama' });
    const t0 = Date.now();
    const response = await openai.chat.completions.create({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10,
    });
    console.log(`   Success in ${Date.now() - t0}ms!`, response.choices[0].message.content);
  } catch (err) {
    console.error("   OpenAI 127.0.0.1 failed:", err.message);
  }
}

test();
