# backend/main.py
from dotenv import load_dotenv
load_dotenv()  # Carica le variabili dal file .env
import os
import json
from uuid import uuid4
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from groq import Groq  # Libreria ufficiale Groq (compatibile con OpenAI)

# Configurazione
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("Imposta la variabile d'ambiente GROQ_API_KEY")

# Inizializzazione client Groq
client = Groq(api_key=GROQ_API_KEY)

app = FastAPI(title="Chatbot Streaming API")

# Abilita CORS per consentire chiamate dal frontend Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Origine del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Struttura in-memory per salvare le conversazioni per sessione
# Formato: session_id -> lista di messaggi (ruolo e contenuto)
sessions: Dict[str, List[Dict[str, str]]] = {}

# Modelli dati per la richiesta
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # Se non fornito, ne creiamo uno nuovo

class ChatResponse(BaseModel):
    session_id: str
    content: str  # Usato per la risposta completa (non streaming)

# Endpoint principale con streaming
@app.post("/chat")
async def chat_stream(request: ChatRequest):
    # 1. Determina o crea la session_id
    session_id = request.session_id or str(uuid4())
    
    # 2. Recupera la cronologia della sessione
    history = sessions.get(session_id, [])
    
    # 3. Aggiunge il messaggio dell'utente alla cronologia
    history.append({"role": "user", "content": request.message})
    
    # Prepara i messaggi per l'LLM (includi un system prompt opzionale)
    messages = [
        {"role": "system", "content": "Sei un assistente utile e amichevole. Rispondi in modo conciso."},
        *history
    ]
    
    # 4. Generatore per lo streaming dei token
    async def token_generator():
        full_assistant_response = ""
        
        try:
            # Chiamata a Groq con streaming abilitato
            stream = client.chat.completions.create(
                model="llama-3.1-8b-instant",  
                messages=messages,
                temperature=0.7,
                stream=True,  # Attiva lo streaming token-by-token
            )
            
            # Itera sui chunk ricevuti
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_assistant_response += token
                    # Invia ogni token come evento SSE
                    yield f"data: {json.dumps({'token': token})}\n\n"
            
            # Una volta finito lo streaming, salva la risposta completa nella cronologia
            history.append({"role": "assistant", "content": full_assistant_response})
            sessions[session_id] = history  # Aggiorna lo store
            
            # Invia un marker di fine stream
            yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"
            
        except Exception as e:
            # In caso di errore, invia un evento di errore
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    # Restituisce una risposta streaming (text/event-stream)
    return StreamingResponse(token_generator(), media_type="text/event-stream")

# Endpoint opzionale per ottenere la cronologia (utile per debug)
@app.get("/history/{session_id}")
def get_history(session_id: str):
    return {"session_id": session_id, "history": sessions.get(session_id, [])}