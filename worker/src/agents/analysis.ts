import { Agent } from 'agents';
import type { AnalysisResult } from '../workflows/analyse';

type AnalysisState = {
	status: 'idle' | 'running' | 'complete' | 'error';
	result: AnalysisResult | null;
	error: string | null;
	code: string | null;
	language: string | null;
};

export class AnalysisAgent extends Agent<Env, AnalysisState> {
	initialState: AnalysisState = {
		status: 'idle',
		result: null,
		error: null,
		code: null,
		language: null
	};

	async onRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// POST /agents/AnalysisAgent/{sessionId}/analyse — start analysis
		if (request.method === 'POST' && url.pathname.endsWith('/analyse')) {
			const { code, language } = (await request.json()) as {
				code: string;
				language: string;
			};

			// Save what we're analysing
			this.setState({
				...this.state,
				status: 'running',
				code,
				language,
				result: null,
				error: null
			});

			// Start the Workflow — this runs asynchronously
			// We don't await it here — the frontend polls for the result
			const instance = await this.env.ANALYSIS_WORKFLOW.create({
				params: { code, language }
			});

			// Poll the workflow result in the background
			this.ctx.waitUntil(this.pollWorkflow(instance.id));

			return Response.json({ status: 'running', workflowId: instance.id });
		}

		// GET /agents/AnalysisAgent/{sessionId} — get current status
		if (request.method === 'GET') {
			return Response.json(this.state);
		}

		return new Response('Not found', { status: 404 });
	}

	// Poll the workflow until it completes, then save result to state
	private async pollWorkflow(workflowId: string) {
		const maxAttempts = 60; // poll for up to 60 seconds
		let attempts = 0;

		while (attempts < maxAttempts) {
			await new Promise((resolve) => setTimeout(resolve, 1000));

			try {
				const instance = await this.env.ANALYSIS_WORKFLOW.get(workflowId);
				const status = await instance.status();

				if (status.status === 'complete') {
					this.setState({
						...this.state,
						status: 'complete',
						result: status.output as any
					});
					return;
				}

				if (status.status === 'errored') {
					this.setState({
						...this.state,
						status: 'error',
						error: 'Analysis failed. Please try again.'
					});
					return;
				}
			} catch (e) {
				console.error('Polling error:', e);
			}

			attempts++;
		}

		this.setState({
			...this.state,
			status: 'error',
			error: 'Analysis timed out.'
		});
	}
}
