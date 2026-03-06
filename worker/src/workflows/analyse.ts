import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

// The input your workflow receives
type AnalysisInput = {
	code: string;
	language: string;
};

// The final result shape
export type AnalysisResult = {
	explanation: string;
	complexity: {
		time: string;
		space: string;
		explanation: string;
	};
	improvements: string[];
};

export class AlgorithmAnalysisWorkflow extends WorkflowEntrypoint<Env, AnalysisInput> {
	async run(event: WorkflowEvent<AnalysisInput>, step: WorkflowStep) {
		const { code, language } = event.payload;

		// Step 1 — Explain what the algorithm does
		// Each step.do() is checkpointed — if it fails, Cloudflare retries
		// from this step, not from the beginning
		const explanation = await step.do('explain algorithm', async () => {
			const result = (await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
				messages: [
					{
						role: 'system',
						content: 'You are an expert computer science tutor. Be concise and clear.'
					},
					{
						role: 'user',
						content: `Explain what this ${language} algorithm does in 2-3 sentences. Focus on what it accomplishes, not how:

\`\`\`${language}
${code}
\`\`\``
					}
				]
			})) as { response: string };

			return result.response;
		});

		// Step 2 — Analyse time and space complexity
		const complexity = await step.do('analyse complexity', async () => {
			const result = (await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
				messages: [
					{
						role: 'system',
						content: `You are an algorithms expert. Always respond in this exact JSON format with no extra text:
{
  "time": "O(?)",
  "space": "O(?)",
  "explanation": "one sentence explaining why"
}`
					},
					{
						role: 'user',
						content: `What is the time and space complexity of this ${language} algorithm?

\`\`\`${language}
${code}
\`\`\``
					}
				]
			})) as { response: string };

			// Parse the JSON response from the AI
			try {
				const cleaned = result.response
					.replace(/```json/g, '')
					.replace(/```/g, '')
					.trim();
				return JSON.parse(cleaned) as {
					time: string;
					space: string;
					explanation: string;
				};
			} catch {
				// Fallback if AI doesn't return valid JSON
				return {
					time: 'Unable to determine',
					space: 'Unable to determine',
					explanation: result.response
				};
			}
		});

		// Step 3 — Suggest improvements
		const improvements = await step.do('suggest improvements', async () => {
			const result = (await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
				messages: [
					{
						role: 'system',
						content: `You are a senior software engineer doing a code review.
Always respond with a JSON array of strings, each being one improvement suggestion.
Maximum 4 suggestions. No extra text, just the JSON array.
Example: ["Use a hash map to reduce lookup time", "Handle edge case of empty input"]`
					},
					{
						role: 'user',
						content: `Suggest improvements for this ${language} algorithm. Focus on performance, readability, and edge cases:

\`\`\`${language}
${code}
\`\`\``
					}
				]
			})) as { response: string };

			try {
				const cleaned = result.response
					.replace(/```json/g, '')
					.replace(/```/g, '')
					.trim();
				return JSON.parse(cleaned) as string[];
			} catch {
				return [result.response];
			}
		});

		return { explanation, complexity, improvements } satisfies AnalysisResult;
	}
}
