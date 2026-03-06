import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

type AnalysisInput = {
	code: string;
	language: string;
};

export type AnalysisResult = {
	explanation: string;
	complexity: {
		time: string;
		space: string;
		explanation: string;
	};
	improvements: string[];
};

// Always returns a plain string regardless of what the AI gives back
function extractString(response: unknown): string {
	if (typeof response === 'string') return response;
	if (typeof response === 'object' && response !== null) return JSON.stringify(response);
	return String(response ?? '');
}

// Extracts and parses the first JSON object found in a string
function extractObject(text: string): Record<string, unknown> | null {
	const match = text.match(/\{[\s\S]*\}/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]);
	} catch {
		return null;
	}
}

// Extracts and parses the first JSON array found in a string
function extractArray(text: string): unknown[] | null {
	const match = text.match(/\[[\s\S]*\]/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]);
	} catch {
		return null;
	}
}

export class AlgorithmAnalysisWorkflow extends WorkflowEntrypoint<Env, AnalysisInput> {
	async run(event: WorkflowEvent<AnalysisInput>, step: WorkflowStep) {
		const { code, language } = event.payload;

		// Step 1 — Explain what the algorithm does
		const explanation = await step.do('explain algorithm', async () => {
			const result = (await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
				messages: [
					{
						role: 'system',
						content:
							'You are an expert computer science tutor. Be concise and clear. Reply in plain text only, no markdown.'
					},
					{
						role: 'user',
						content: `Explain what this ${language} algorithm does in 2-3 sentences. Focus on what it accomplishes, not how:\n\n${code}`
					}
				]
			})) as { response: unknown };

			return extractString(result.response);
		});

		// Step 2 — Analyse time and space complexity
		const complexity = await step.do('analyse complexity', async () => {
			const result = (await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
				messages: [
					{
						role: 'system',
						content:
							'You are an algorithms expert. Respond with ONLY raw JSON, no markdown, no backticks, no extra text.'
					},
					{
						role: 'user',
						content: `What is the time and space complexity of this ${language} algorithm?

Respond with ONLY this exact JSON shape:
{"time":"O(?)","space":"O(?)","explanation":"one sentence why"}

Algorithm:
${code}`
					}
				]
			})) as { response: unknown };

			// Always convert to string first, no matter what the AI returns
			const raw = extractString(result.response)
				.replace(/```json/gi, '')
				.replace(/```/g, '')
				.trim();

			const parsed = extractObject(raw);

			if (parsed) {
				// Unwrap nested object if AI returned {"explanation": {"time":...}}
				const actual = (parsed.time ? parsed : (parsed.explanation ?? parsed)) as Record<
					string,
					unknown
				>;
				return {
					time: extractString(actual.time ?? 'N/A'),
					space: extractString(actual.space ?? 'N/A'),
					explanation:
						typeof actual.explanation === 'string'
							? actual.explanation
							: extractString(actual.explanation ?? raw)
				};
			}

			// Complete fallback
			return { time: 'N/A', space: 'N/A', explanation: raw };
		});

		// Step 3 — Suggest improvements
		const improvements = await step.do('suggest improvements', async () => {
			const result = (await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
				messages: [
					{
						role: 'system',
						content:
							'You are a senior software engineer. Respond with ONLY a raw JSON array of strings. No markdown, no backticks, no extra text. Example: ["improvement one","improvement two"]'
					},
					{
						role: 'user',
						content: `List up to 4 improvements for this ${language} algorithm focusing on performance, readability, and edge cases:

${code}`
					}
				]
			})) as { response: unknown };

			const raw = extractString(result.response)
				.replace(/```json/gi, '')
				.replace(/```/g, '')
				.trim();

			const parsed = extractArray(raw);

			if (parsed) {
				// Flatten [[item1, item2]] → [item1, item2]
				const flat = Array.isArray(parsed[0]) ? (parsed[0] as unknown[]) : parsed;
				return flat.map((item) => (typeof item === 'string' ? item : extractString(item)));
			}

			// Fallback: split by newline and clean up
			return raw
				.split('\n')
				.map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
				.filter(Boolean)
				.slice(0, 4);
		});

		return { explanation, complexity, improvements } satisfies AnalysisResult;
	}
}
