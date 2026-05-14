// frontend/app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';  // Genera session_id univoco

// Definizione del tipo per un singolo messaggio
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Home() {
  // Stato dei messaggi nella chat
  const [messages, setMessages] = useState<Message[]>([]);
  // Testo inserito dall'utente
  const [input, setInput] = useState('');
  // Indica se stiamo aspettando una risposta dall'LLM
  const [isLoading, setIsLoading] = useState(false);
  // ID della sessione (persiste nel localStorage)
  const [sessionId, setSessionId] = useState<string>('');
  
  // Ref per lo scrolling automatico
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inizializzazione: carica o genera session_id
  useEffect(() => {
    let storedSession = localStorage.getItem('chat_session_id');
    if (!storedSession) {
      storedSession = uuidv4();
      localStorage.setItem('chat_session_id', storedSession);
    }
    setSessionId(storedSession);
  }, []);

  // Scroll automatico alla fine dei messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Gestisce l'invio del messaggio
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    // Aggiunge il messaggio utente alla UI subito
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Aggiunge un placeholder per la risposta dell'assistente (verrà riempito in streaming)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      // Chiamata all'endpoint di streaming
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          session_id: sessionId,
        }),
      });

      if (!response.body) throw new Error('ReadableStream non supportato');

      // Legge lo stream come testo
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';        // Accumula i chunk (possono arrivare frammentati)
      let assistantMsg = '';  // Accumula la risposta completa

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Gli eventi SSE sono separati da "\n\n"
        const events = buffer.split('\n\n');
        // L'ultimo elemento potrebbe essere incompleto, lo lasciamo nel buffer
        buffer = events.pop() || '';

        for (const event of events) {
          if (event.startsWith('data: ')) {
            const jsonStr = event.slice(6); // Rimuove "data: "
            try {
              const data = JSON.parse(jsonStr);
              if (data.token) {
                assistantMsg += data.token;
                // Aggiorna l'ultimo messaggio dell'assistente nella UI
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg.role === 'assistant') {
                    lastMsg.content = assistantMsg;
                  }
                  return newMessages;
                });
              } else if (data.done) {
                // Fine stream: eventuale aggiornamento finale
                console.log('Stream completato', data.session_id);
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (err) {
              console.error('Errore parsing JSON:', err);
            }
          }
        }
      }
    } catch (error) {
      console.error('Errore nella richiesta:', error);
      // Sostituisce il placeholder con un messaggio di errore
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg.role === 'assistant') {
          lastMsg.content = '❌ Errore: impossibile ottenere risposta.';
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">🤖 Chatbot Streaming</h1>
      
      {/* Area dei messaggi */}
      <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-gray-400 text-center mt-10">
            Invia un messaggio per iniziare...
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-300 text-gray-800'
              }`}
            >
              {msg.content || (msg.role === 'assistant' && isLoading && idx === messages.length-1 ? (
                <span className="inline-block w-4 h-4 animate-pulse">●</span>
              ) : msg.content)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input e pulsante */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Scrivi un messaggio..."
          disabled={isLoading}
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium px-6 py-2 rounded-lg transition"
        >
          {isLoading ? '...' : 'Invia'}
        </button>
      </div>
    </div>
  );
}