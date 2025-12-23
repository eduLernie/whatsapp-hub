const socket = io();

let fila = [];
let chats = {};
let atual = null;

const filaDiv = document.getElementById("fila");
const mensagensDiv = document.getElementById("mensagens");
const titulo = document.getElementById("titulo");

/* ================= SOCKETS ================= */

socket.on("fila:update", data => {
  fila = data;
  renderFila();
});

socket.on("chat:update", data => {
  chats = data;

  if (atual && chats[atual]) {
    titulo.innerText = chats[atual].nome;
    renderChat(chats[atual].mensagens);
  }
});

/* ================= FILA ================= */

function renderFila() {
  filaDiv.innerHTML = "";

  fila.forEach(c => {
    const div = document.createElement("div");
    div.className = "item-fila";
    div.innerHTML = `<strong>${c.nome}</strong>`;
    div.onclick = () => assumir(c.numero);
    filaDiv.appendChild(div);
  });
}

function assumir(numero) {
  atual = numero;
  mensagensDiv.innerHTML = "";
  titulo.innerText = "Carregando atendimento...";

  socket.emit("assumir", numero);
}

/* ================= CHAT ================= */

function renderChat(mensagens) {
  mensagensDiv.innerHTML = "";

  mensagens.forEach(m => {
    const div = document.createElement("div");
    div.className = `msg ${m.de}`;

    if (m.tipo === "imagem") {
      const img = document.createElement("img");
      img.src = `data:${m.mime};base64,${m.data}`;
      img.style.maxWidth = "200px";
      img.style.borderRadius = "6px";
      div.appendChild(img);
    } else {
      div.innerText = m.texto;
    }

    mensagensDiv.appendChild(div);
  });

  mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
}

/* ================= AÇÕES ================= */

function enviar() {
  const campo = document.getElementById("mensagem");
  const texto = campo.value.trim();

  if (!texto || !atual) return;

  socket.emit("enviar", {
    numero: atual,
    mensagem: texto
  });

  campo.value = "";
}

function encerrar() {
  if (!atual) return;

  socket.emit("encerrar", atual);

  mensagensDiv.innerHTML = "";
  titulo.innerText = "Conversa encerrada";
  atual = null;
}
