# AlgoLens

AlgoLens leverages the power of AI and allows you to analyse your algorithms.
Digest of your algorithms provides the explanation, space and time complexity and suggestions how to improve.

## Usage
### Website (recommended)
1. Go to [algolens.def1de.com](https://algolens.def1de.com/)
2. Select your language
3. Paste your algorithm to the box below or click *load example* to see a demo. (Only python and JS examples available)
4. Click *Run Analysis* button and wait for the result

### Local
1. Clone this repo
```
git clone https://github.com/iktrnch/cf_ai_algolens.git algolens
cd ./algolens
```
2. Build the Svelte frontend
```
cd web
npm install
npm run build
```
3. Run the Hono worker (NOTE: You may need to login to Wrangler via Cloudflare)
```
cd ../worker
npm install
npm run dev
```
4. Go to [localhost:8787](http://localhost:8787)
5. Select your language
6. Paste your algorithm to the box below or click *load example* to see a demo. (Only python and JS examples available)
7. Click *Run Analysis* button and wait for the result
