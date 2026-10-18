// apps/painel/src/App.tsx
// Painel do profissional — login e agendamentos do dia (Q5/Q6).
// Consome a API do Worker (/api/auth e /api/agendamentos) com cookie de sessão.

import { useEffect, useState } from 'react';

interface Agendamento {
  id: number;
  dataHoraInicio: string;
  dataHoraFim: string;
  status: string;
  clienteNome: string;
  clienteTelefone: string;
  servicoNome: string;
}

export default function App() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [logado, setLogado] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [dia, setDia] = useState(new Date().toISOString().slice(0, 10));

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (res.ok) {
      setLogado(true);
      carregarAgendamentos();
    } else {
      alert('Credenciais inválidas');
    }
  }

  async function carregarAgendamentos() {
    const res = await fetch(`/api/agendamentos?dia=${dia}`);
    if (res.ok) {
      const data = await res.json();
      setAgendamentos(data.agendamentos);
    }
  }

  async function cancelar(id: number) {
    await fetch(`/api/agendamentos/${id}/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'cancelado pelo profissional' }),
    });
    carregarAgendamentos();
  }

  useEffect(() => {
    if (logado) carregarAgendamentos();
  }, [logado, dia]);

  if (!logado) {
    return (
      <form onSubmit={login}>
        <h1>Agendador Ethos</h1>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" />
        <button type="submit">Entrar</button>
      </form>
    );
  }

  return (
    <div>
      <h1>Agendamentos</h1>
      <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
      <ul>
        {agendamentos.map((a) => (
          <li key={a.id}>
            {a.dataHoraInicio.slice(11, 16)} — {a.clienteNome} ({a.servicoNome})
            <button onClick={() => cancelar(a.id)}>Cancelar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}