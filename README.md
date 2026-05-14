# 🧠 Streaming Chatbot – Next.js + FastAPI + Groq

A real‑time token‑by‑token streaming chatbot that maintains conversation context per session.  
Built with modern asynchronous patterns to deliver a responsive user experience.

## ✨ Features

- **Token‑by‑token streaming** – responses appear as they are generated (Server‑Sent Events)
- **Session persistence** – conversation history is kept on the backend per `session_id`
- **Full‑stack async** – FastAPI (Python) async endpoints + Next.js (React) streaming fetch
- **LLM powered** – uses Groq’s ultra‑fast inference (LLaMA 3.3 70B)

## 🧰 Tech Stack

| Layer       | Technology                         |
|-------------|------------------------------------|
| Frontend    | Next.js 14 (App Router), TailwindCSS |
| Backend     | FastAPI (Python 3.12+)             |
| LLM API     | Groq (compatible with OpenAI SDK)  |
| Communication | Server‑Sent Events (SSE) + HTTP |

## 📋 Prerequisites

- Python 3.12 or higher
- Node.js 18+ and npm
- A [Groq](https://console.groq.com) API key (free tier available)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/streaming-chatbot.git
cd streaming-chatbot

cd backend
python -m venv venv
source venv/bin/activate      # Linux/Mac
# or
venv\Scripts\activate          # Windows

pip install -r requirements.txt

Create a .env file inside the backend folder:

GROQ_API_KEY=your_groq_api_key_here

Start the backend server:

uvicorn main:app --reload --port 8000

Frontend setup (Next.js)

cd frontend
npm install
npm run dev