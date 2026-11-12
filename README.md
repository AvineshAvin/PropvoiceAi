# PropVoice AI

**An Intelligent Voice-Based Real Estate Lead Qualification & Engagement Agent**

PropVoice AI is a full-stack AI-powered real-estate SaaS platform that conducts natural voice and text conversations with prospective property buyers and renters, extracts structured requirements, qualifies leads on a transparent 0–100 scoring engine (`HOT`, `WARM`, `COLD`), recommends database-backed properties across Bangalore, Chennai, and Hyderabad, and manages conversations and follow-ups in a modern CRM dashboard.

---

## Tech Stack

- **Frontend:** React.js (Vite), Tailwind CSS, React Router, Axios, Lucide React
- **Voice AI:** Browser Web Speech API (Speech-to-Text) + SpeechSynthesis API (Text-to-Speech) with graceful text fallback & permission handling
- **Backend:** Python 3.11+, FastAPI, Pydantic v2, Uvicorn
- **AI / LLM:** Google Gemini API (`google-genai` SDK) with structured JSON output and resilient rule-based fallback
- **Database:** MongoDB (`pymongo`) with automatic local JSON fallback (`backend/local_data/db.json`) if MongoDB is not running locally

---

## Project Structure

```text
PropVoice AI/
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── data/sample_properties.py
│   │   ├── models/schemas.py
│   │   ├── routes/
│   │   │   ├── agent.py
│   │   │   ├── properties.py
│   │   │   ├── leads.py
│   │   │   ├── conversations.py
│   │   │   ├── followups.py
│   │   │   └── dashboard.py
│   │   └── services/
│   │       ├── ai_agent.py
│   │       ├── lead_qualification.py
│   │       └── property_service.py
│   └── tests/
│       └── test_api.py
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── hooks/useVoiceAssistant.js
        ├── services/api.js
        ├── components/
        └── pages/
```

---

## Setup & Execution

### 1. Environment Variables
Copy `.env.example` to `.env` in the project root (or `backend/.env`) and add your Gemini API key and MongoDB URI:
```bash
cp .env.example .env
```

### 2. Backend (FastAPI + MongoDB)
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API docs are available at `http://localhost:8000/docs`.

### 3. Frontend (React + Vite)
Requires Node.js 18+:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in Chrome or Edge (recommended for Web Speech API support).

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service, database mode, and Gemini status |
| `POST` | `/api/agent/chat` | Conversational AI turn, requirement extraction, lead scoring & persistence |
| `POST` | `/api/agent/extract-requirements` | Extract structured requirements & score from raw text |
| `GET` | `/api/properties` | List/filter/sort properties (`city`, `location`, `bhk`, `property_type`, `listing_type`, `max_price`, `sort_by`) |
| `GET` | `/api/properties/{property_id}` | Get single property details |
| `POST` | `/api/properties` | Create property listing |
| `PUT` | `/api/properties/{property_id}` | Update property listing |
| `GET` | `/api/leads` | List leads (`status`, `search`) |
| `GET` | `/api/leads/{lead_id}` | Get lead details |
| `POST` | `/api/leads` | Create lead |
| `PUT` | `/api/leads/{lead_id}` | Update lead status, CRM stage, requirements, or notes |
| `GET` | `/api/conversations` | List saved conversations (`search`) |
| `GET` | `/api/conversations/{conversation_id}` | Get full transcript & summary |
| `POST` | `/api/followups` | Create follow-up task or site visit |
| `GET` | `/api/followups` | List follow-ups (`status`, `lead_id`) |
| `PUT` | `/api/followups/{followup_id}` | Update follow-up status or schedule |
| `GET` | `/api/dashboard/stats` | Aggregated CRM & inventory metrics |
| `GET` / `PUT` | `/api/settings/scoring` | Read or update configurable lead scoring weights |

### Sample API Requests
```bash
# 1. Start a conversation with the AI Agent
curl -X POST http://localhost:8000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to buy a 2 BHK apartment in Whitefield Bangalore around 80 lakhs"}'

# 2. Filter properties
curl "http://localhost:8000/api/properties?city=Bangalore&bhk=2%20BHK&max_price=8000000"
```

---

## Running Tests

```bash
cd backend
python -m pytest -v tests/test_api.py
```
The test suite verifies health checks, property filtering/CRUD, structured requirement extraction, lead scoring (`HOT`/`WARM`/`COLD`), multi-turn conversational context retention, conversation persistence, follow-up management, and scoring weight validation.
