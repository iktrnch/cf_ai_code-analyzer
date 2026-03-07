import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { agentsMiddleware } from 'hono-agents';
import { getAgentByName } from 'agents';

export { AnalysisAgent } from './agents/analysis';
export { AlgorithmAnalysisWorkflow } from './workflows/analyse';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware for API routes - allows requests from the frontend
app.use('*', cors());

// Endpoint to analyse code - forwards the request to the appropriate Durable Object agent based on sessionId
app.post('/api/analyse/:sessionId', async (c) => {
	const sessionId = c.req.param('sessionId');
	const { code, language } = await c.req.json();

	// Get (or create) the Durable Object instance for this session
	const agent = await getAgentByName(c.env.AnalysisAgent, sessionId);

	// Forward the request to the agent's onRequest handler
	const url = new URL(c.req.url);
	const agentRequest = new Request(`${url.origin}/analyse`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code, language })
	});

	return agent.fetch(agentRequest);
});

// Endpoint to check the status/responce of the analysis agent for a session
app.get('/api/status/:sessionId', async (c) => {
	const sessionId = c.req.param('sessionId');
	const agent = await getAgentByName(c.env.AnalysisAgent, sessionId);

	const agentRequest = new Request('https://agent/', {
		method: 'GET'
	});

	return agent.fetch(agentRequest);
});

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// agentsMiddleware last — only handles WebSocket upgrades now
app.use('*', agentsMiddleware());

export default app;
