const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const tecnicos = require("./tecnicos");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const fila = [];
const atendimentos = {};

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

client.on("qr", qr => {
  console.log("📱 Escaneie o QR Code:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp conectado");
});

client.on("message", async msg => {
  const numero = msg.from;

  // 🔒 FILTRO: só técnicos cadastrados
  if (!tecnicos[numero]) {
    console.log("Ignorado:", numero);
    return;
  }

  let conteudo;
  if (msg.hasMedia) {
    const media = await msg.downloadMedia();
    conteudo = {
      tipo: "imagem",
      mime: media.mimetype,
      data: media.data
    };
  } else {
    conteudo = {
      tipo: "texto",
      texto: msg.body
    };
  }

  // Se já está em atendimento
  if (atendimentos[numero]) {
    atendimentos[numero].mensagens.push({ de: "cliente", ...conteudo });
    io.emit("chat:update", atendimentos);
    return;
  }

  // Se já está na fila
  const existente = fila.find(f => f.numero === numero);
  if (existente) {
    existente.mensagens.push({ de: "cliente", ...conteudo });
    io.emit("fila:update", fila);
    return;
  }

  // Novo na fila
  fila.push({
    numero,
    nome: tecnicos[numero].nome,
    mensagens: [{ de: "cliente", ...conteudo }]
  });

  io.emit("fila:update", fila);
});

io.on("connection", socket => {
  console.log("🖥️ Front conectado");

  socket.emit("fila:update", fila);
  socket.emit("chat:update", atendimentos);

  socket.on("assumir", numero => {
    const index = fila.findIndex(f => f.numero === numero);
    if (index === -1) return;

    const chat = fila.splice(index, 1)[0];
    atendimentos[numero] = {
      ...chat,
      analista: socket.id
    };

    io.emit("fila:update", fila);
    io.emit("chat:update", atendimentos);
  });

  socket.on("enviar", async ({ numero, mensagem }) => {
    try {
      await client.sendMessage(numero, mensagem);
      atendimentos[numero].mensagens.push({
        de: "analista",
        tipo: "texto",
        texto: mensagem
      });
      io.emit("chat:update", atendimentos);
    } catch (e) {
      console.error("Erro ao enviar:", e.message);
    }
  });

  socket.on("encerrar", numero => {
    delete atendimentos[numero];
    io.emit("chat:update", atendimentos);
  });
});

server.listen(3000, () => {
  console.log("🚀 Servidor rodando em http://localhost:3000");
});

client.initialize();
