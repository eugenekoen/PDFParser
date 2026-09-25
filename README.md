# Bank Statement PDF to 5-Column CSV Parser (ZAR)

A fullstack web application designed to convert bank statement PDFs of any layout (digital or scanned) into clean, normalized 5-column CSV files (`Date, Description, Debit, Credit, Balance`) in **South African Rand (R)** using **Google Gemini** with native multimodal visual OCR.

---

## 🌟 Key Features

1. **Google Gemini Multimodal Vision & OCR Engine**:
   - **Massive 1,000,000+ Token Context**: Ingests entire 50+ page bank statements in a single cloud request without loading your PC's memory.
   - **Native Visual OCR**: Automatically reads scanned statements, smartphone photos, and non-selectable PDF tables.
   - **Auto-Model Discovery**: Automatically queries Google's API and selects the latest model (`gemini-3.8-flash`).
   - **High-Demand Self-Healing & Retry Button**: If a model experiences a temporary demand spike (HTTP 503), the backend automatically falls back to companion Flash models, and the UI displays a dedicated **Retry Extraction** button.

2. **Zero-Leak Company Passphrase Unlock**:
   - The raw API key is **NEVER exposed publicly** or stored as plaintext in the static build.
   - The API key is encrypted using **AES-256-GCM** with 100,000 rounds of PBKDF2.
   - Company staff unlock the app on any device simply by typing the secret company passphrase.

3. **South African Rand (ZAR) & Format**:
   - All amounts displayed as **`R ###,###,###.##`** (e.g. `R 1,250.50`, `R 184,320.00`).
   - Spreadsheet-style inline cell editing.

4. **Standard 5-Column RFC-4180 CSV Export**:
   - Clean export strictly matching `Date, Description, Debit, Credit, Balance`.
   - Direct download and one-click copy to clipboard.

---

## 🚀 Running Locally

### 1. Configure Server API Key (One-time)
Create or edit `server/.env`:
```env
PORT=3001
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```

### 2. Start the App
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🌐 Deploying to GitHub Pages (Static Hosting)

The repository includes a ready-to-run GitHub Actions workflow that automatically deploys the frontend to GitHub Pages on every push to `main`.

### Step 1: Add GitHub Secrets (One-time)
In your repository on GitHub:
1. Go to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret**:
   - Name: `GEMINI_API_KEY`
   - Value: `your_actual_gemini_api_key_here`
3. Click **New repository secret**:
   - Name: `APP_PASSPHRASE`
   - Value: `your_secret_passphrase_here`

During deployment, GitHub Actions will use the passphrase to **AES-256-GCM encrypt** the API key so that the plaintext key is **never baked into the public bundle**.

### Step 2: Push Code to GitHub
```bash
git add .
git commit -m "Deploy bank statement parser with passphrase unlock"
git push origin main
```

*(Note: `server/.env` is strictly ignored by `.gitignore` and will never be pushed).*

### Step 3: Enable GitHub Pages in your Repository
1. On GitHub, go to your repository **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.

### Step 4: How Staff Use the App Anywhere
1. Staff members open the GitHub Pages URL on any computer.
2. Click **Unlock App** (or the prompt banner).
3. Type the company passphrase you set in GitHub secrets.
4. The browser locally decrypts the key into memory. Staff never have to copy, paste, or remember the complex Gemini API key!
