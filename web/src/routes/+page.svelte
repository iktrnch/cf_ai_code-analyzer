<script lang="ts">
	import { onMount } from 'svelte';

	// --- Types ---
	type ComplexityResult = {
		time: string;
		space: string;
		explanation: string;
	};

	type AnalysisResult = {
		explanation: string;
		complexity: ComplexityResult;
		improvements: string[];
	};

	type AnalysisState = {
		status: 'idle' | 'running' | 'complete' | 'error';
		result: AnalysisResult | null;
		error: string | null;
		code: string | null;
		language: string | null;
	};

	// --- State ---
	let code = $state('');
	let language = $state('python');
	let analysisState = $state<AnalysisState>({
		status: 'idle',
		result: null,
		error: null,
		code: null,
		language: null
	});
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let highlightedCode = $state('');
	let stepVisible = $state({ explanation: false, complexity: false, improvements: false });

	const sessionId = sessionStorage.getItem('analyzerSession') ?? crypto.randomUUID();
	sessionStorage.setItem('analyzerSession', sessionId);

	const languages = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust'];

	// Example algorithm to demo the tool
	const examples: Record<string, string> = {
		python: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,
		javascript: `function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  return result.concat(left.slice(i)).concat(right.slice(j));
}`
	};

	// Animate result sections in when analysis completes
	$effect(() => {
		if (analysisState.status === 'complete') {
			setTimeout(() => (stepVisible.explanation = true), 100);
			setTimeout(() => (stepVisible.complexity = true), 300);
			setTimeout(() => (stepVisible.improvements = true), 500);
		} else {
			stepVisible = { explanation: false, complexity: false, improvements: false };
		}
	});

	async function analyse() {
		if (!code.trim() || analysisState.status === 'running') return;

		analysisState = { status: 'running', result: null, error: null, code, language };

		try {
			const res = await fetch(`/api/analyse/${sessionId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code, language })
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			// Start polling for result
			startPolling();
		} catch (e) {
			analysisState = { ...analysisState, status: 'error', error: String(e) };
		}
	}

	function startPolling() {
		if (pollInterval) clearInterval(pollInterval);

		pollInterval = setInterval(async () => {
			try {
				const res = await fetch(`/api/status/${sessionId}`);
				const state: AnalysisState = await res.json();

				// Skip if status hasn't been set yet
				if (!state.status) return;

				analysisState = state;

				if (state.status === 'complete' || state.status === 'error') {
					clearInterval(pollInterval!);
					pollInterval = null;
				}
			} catch (e) {
				console.error('Poll error:', e);
			}
		}, 1500); // Continually poll every 1.5 seconds until complete or error
	}

	function loadExample() {
		// Load example code for the selected language, or default to Python if not available
		code = examples[language];
		if (!code) {
			code = examples['python'];
			language = 'python';
		}
	}

	function reset() {
		// Clear code and reset state to initial
		if (pollInterval) clearInterval(pollInterval);
		analysisState = { status: 'idle', result: null, error: null, code: null, language: null };
	}

	onMount(() => {
		return () => {
			// Make sure no intervals are left running when component unmounts
			if (pollInterval) clearInterval(pollInterval);
		};
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<!-- FONTS -->
	<link
		href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="min-h-screen bg-[#0a0a0a] text-[#e2e2e2]" style="font-family: 'Syne', sans-serif;">
	<!-- Subtle grid background -->
	<div
		class="pointer-events-none fixed inset-0 opacity-[0.03]"
		style="background-image: linear-gradient(#4ade80 1px, transparent 1px), linear-gradient(90deg, #4ade80 1px, transparent 1px); background-size: 40px 40px;"
	></div>

	<!-- Header -->
	<header
		class="relative z-10 flex items-center justify-between border-b border-[#1e1e1e] px-8 py-5"
	>
		<div class="flex items-center gap-3">
			<div class="h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
			<span class="font-mono text-sm tracking-widest text-green-400 uppercase">AlgoLens</span>
		</div>
		<div class="flex flex-col gap-1 text-right font-mono text-xs tracking-wider text-[#444]">
			<span>Powered by Cloudflare Workers AI</span>
			<span>
				Developed by <a href="https://github.com/iktrnch" class="underline hover:text-green-400"
					>Illia Katerynych</a
				>
			</span>
		</div>
	</header>

	<main class="relative z-10 mx-auto max-w-6xl px-8 py-12">
		<!-- Hero text -->
		<div class="mb-12">
			<h1
				class="mb-3 text-5xl leading-none font-black tracking-tight text-white"
				style="font-family: 'Syne', sans-serif;"
			>
				Algorithm<br />
				<span class="text-green-400">Analysis.</span>
			</h1>
			<p class="font-mono text-sm text-[#555]">
				Paste your algorithm. Get complexity, explanation, and improvements.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Left: Input panel -->
			<div class="flex flex-col gap-4">
				<!-- Language + controls bar -->
				<div class="flex items-center justify-between">
					<div class="flex flex-row flex-wrap gap-2 lg:grid-cols-4">
						{#each languages as lang}
							<button
								onclick={() => (language = lang)}
								class="rounded px-3 py-1.5 font-mono text-xs transition-all duration-150
                  {language === lang
									? 'bg-green-400 font-bold text-black'
									: 'border border-[#222] text-[#555] hover:border-[#333] hover:text-green-400'}"
							>
								{lang}
							</button>
						{/each}
					</div>
					<button
						onclick={loadExample}
						class="ml-2 min-w-fit self-stretch rounded border border-[#222] px-3 font-mono text-xs text-[#444] transition-colors hover:border-[#333] hover:text-green-400"
					>
						load example →
					</button>
				</div>

				<!-- Code input -->
				<div class="group relative">
					<textarea
						bind:value={code}
						placeholder="// paste your algorithm here"
						class="h-80 w-full resize-none rounded-lg border border-[#1e1e1e]
                   bg-[#0f0f0f] p-5 font-mono text-sm
                   leading-relaxed text-[#ccc] placeholder-[#2a2a2a] transition-colors
                   duration-200 group-hover:border-[#2a2a2a] focus:border-green-400/40 focus:outline-none"
						style="font-family: 'JetBrains Mono', monospace;"
						spellcheck="false"
					></textarea>
					<!-- Character count -->
					<div class="absolute right-4 bottom-3 font-mono text-xs text-[#333]">
						{code.length} chars
					</div>
				</div>

				<!-- Analyse button -->
				<button
					onclick={analyse}
					disabled={!code.trim() || analysisState.status === 'running'}
					class="w-full rounded-lg py-4 font-mono text-sm font-bold tracking-widest
                 uppercase transition-all duration-200
                 {!code.trim() || analysisState.status === 'running'
						? 'cursor-not-allowed border border-[#1a1a1a] bg-[#111] text-[#333]'
						: 'bg-green-400 text-black hover:bg-green-300 active:scale-[0.99]'}"
				>
					{#if analysisState.status === 'running'}
						<span class="flex items-center justify-center gap-3">
							<span
								class="inline-block h-3 w-3 animate-spin rounded-full border border-black border-t-transparent"
							></span>
							Analysing...
						</span>
					{:else}
						→ Run Analysis
					{/if}
				</button>

				<!-- Workflow steps indicator (shown while running) -->
				{#if analysisState.status === 'running'}
					<div class="space-y-3 rounded-lg border border-[#1e1e1e] p-4">
						<p class="mb-3 font-mono text-xs tracking-widest text-[#444] uppercase">
							Workflow steps
						</p>
						{#each ['Explaining algorithm', 'Computing complexity', 'Finding improvements'] as step, i}
							<div class="flex items-center gap-3">
								<div
									class="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400"
									style="animation-delay: {i * 300}ms"
								></div>
								<span class="font-mono text-xs text-[#555]">{step}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Right: Results panel -->
			<div class="flex flex-col gap-4">
				{#if analysisState.status === 'idle'}
					<!-- Empty state -->
					<div
						class="flex h-full min-h-80 items-center justify-center rounded-lg
                      border border-dashed border-[#1a1a1a]"
					>
						<p class="text-center font-mono text-xs leading-loose text-[#2a2a2a]">
							results will appear here<br />after analysis
						</p>
					</div>
				{:else if analysisState.status === 'error'}
					<div class="rounded-lg border border-red-900/50 bg-red-950/20 p-5">
						<p class="mb-2 font-mono text-xs tracking-widest text-red-400 uppercase">Error</p>
						<p class="font-mono text-sm text-red-300">{analysisState.error}</p>
						<button
							onclick={reset}
							class="mt-4 font-mono text-xs text-[#444] transition-colors hover:text-white"
						>
							← reset
						</button>
					</div>
				{:else if analysisState.status === 'running'}
					<div
						class="flex h-full min-h-80 items-center justify-center
                      rounded-lg border border-[#1e1e1e]"
					>
						<div class="space-y-3 text-center">
							<div
								class="inline-block h-6 w-6 animate-spin rounded-full border border-green-400 border-t-transparent"
							></div>
							<p class="font-mono text-xs text-[#444]">running workflow...</p>
						</div>
					</div>
				{:else if analysisState.status === 'complete' && analysisState.result}
					{@const r = analysisState.result}

					<!-- Explanation -->
					<div
						class="rounded-lg border border-[#1e1e1e] p-5 transition-all duration-500
                      {stepVisible.explanation
							? 'translate-y-0 opacity-100'
							: 'translate-y-4 opacity-0'}"
					>
						<div class="mb-3 flex items-center gap-2">
							<span class="font-mono text-xs tracking-widest text-green-400 uppercase"
								>01 / Explanation</span
							>
						</div>
						<p class="text-sm leading-relaxed text-[#bbb]">{r.explanation}</p>
					</div>

					<!-- Complexity -->
					<div
						class="rounded-lg border border-[#1e1e1e] p-5 transition-all duration-500
                      {stepVisible.complexity
							? 'translate-y-0 opacity-100'
							: 'translate-y-4 opacity-0'}"
					>
						<div class="mb-4 flex items-center gap-2">
							<span class="font-mono text-xs tracking-widest text-green-400 uppercase"
								>02 / Complexity</span
							>
						</div>
						<div class="mb-4 grid grid-cols-2 gap-3">
							<div class="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] p-4 text-center">
								<p class="mb-2 font-mono text-xs tracking-widest text-[#444] uppercase">Time</p>
								<p class="font-mono text-2xl font-bold text-green-400">{r.complexity.time}</p>
							</div>
							<div class="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] p-4 text-center">
								<p class="mb-2 font-mono text-xs tracking-widest text-[#444] uppercase">Space</p>
								<p class="font-mono text-2xl font-bold text-green-400">{r.complexity.space}</p>
							</div>
						</div>
						<p class="font-mono text-xs leading-relaxed text-[#666]">{r.complexity.explanation}</p>
					</div>

					<!-- Improvements -->
					<div
						class="rounded-lg border border-[#1e1e1e] p-5 transition-all duration-500
                      {stepVisible.improvements
							? 'translate-y-0 opacity-100'
							: 'translate-y-4 opacity-0'}"
					>
						<div class="mb-4 flex items-center gap-2">
							<span class="font-mono text-xs tracking-widest text-green-400 uppercase"
								>03 / Improvements</span
							>
						</div>
						<ul class="space-y-3">
							{#each r.improvements as improvement, i}
								<li class="flex gap-3">
									<span class="mt-0.5 shrink-0 font-mono text-xs text-[#333]">
										{String(i + 1).padStart(2, '0')}
									</span>
									<span class="text-sm leading-relaxed text-[#bbb]">{improvement}</span>
								</li>
							{/each}
						</ul>

						<button
							onclick={reset}
							class="mt-6 font-mono text-xs text-[#444] transition-colors hover:text-green-400"
						>
							← analyse another
						</button>
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>
