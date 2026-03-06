import { agentFetch } from 'agents/client';

// agentFetch is like regular fetch but it routes to the right
// Durable Object instance automatically
export async function sendMessage(
	sessionId: string,
	messages: { role: string; content: string }[]
) {
	const response = await agentFetch(
		{
			agent: 'ChatAgent',
			name: sessionId,
			host: 'localhost:8787'
		},
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages })
		}
	);

	return response;
}
