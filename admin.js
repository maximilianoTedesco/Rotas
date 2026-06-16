let mapa;
let marcador;

verificarLogin();

function verificarLogin() {
  const usuario = localStorage.getItem("usuarioLogado");

  if (usuario !== "admin") {
    window.location.href = "index.html";
  }
}

function salvarRota() {
  const rota = {
    nome: document.getElementById("nomeRota").value,
    data: document.getElementById("dataRota").value,
    horarioInicio: document.getElementById("horarioInicio").value
  };

  localStorage.setItem("rotaAtual", JSON.stringify(rota));
  alert("Rota salva com sucesso!");
}

function carregarRota() {
  const rotaSalva = JSON.parse(localStorage.getItem("rotaAtual"));

  if (rotaSalva) {
    document.getElementById("nomeRota").value = rotaSalva.nome || "";
    document.getElementById("dataRota").value = rotaSalva.data || "";
    document.getElementById("horarioInicio").value = rotaSalva.horarioInicio || "";
  }
}

function iniciarMapa() {
  mapa = L.map("map").setView([37.1365, -8.5377], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(mapa);

  setTimeout(() => {
    mapa.invalidateSize();
  }, 500);

  mapa.on("click", function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    document.getElementById("coordenadas").value =
      `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    if (marcador) {
      mapa.removeLayer(marcador);
    }

    marcador = L.marker([lat, lng]).addTo(mapa);
  });
}

function adicionarPonto() {
  const nomePonto = document.getElementById("nomePonto").value;
  const coordenadas = document.getElementById("coordenadas").value;
  const qtdPassageiros = document.getElementById("qtdPassageiros").value;
  const horarioPrevisto = document.getElementById("horarioPrevisto").value;
  const observacao = document.getElementById("observacao").value;

  if (!coordenadas) {
    alert("Selecione um ponto no mapa.");
    return;
  }

  const partes = coordenadas.split(",");
  const latitude = partes[0].trim();
  const longitude = partes[1].trim();

  if (!nomePonto || !latitude || !longitude || !qtdPassageiros || !horarioPrevisto) {
    alert("Preencha nome, ponto no mapa, quantidade e horário.");
    return;
  }

  const pontos = buscarPontos();

  const novoPonto = {
    id: Date.now(),
    ordem: pontos.length + 1,
    nomePonto,
    latitude,
    longitude,
    qtdPassageiros,
    horarioPrevisto,
    observacao,
    status: "pendente"
  };

  pontos.push(novoPonto);
  localStorage.setItem("pontosColeta", JSON.stringify(pontos));

  limparFormularioPonto();
  listarPontos();
}

function buscarPontos() {
  return JSON.parse(localStorage.getItem("pontosColeta")) || [];
}

function listarPontos() {
  const pontos = buscarPontos();
  const lista = document.getElementById("listaPontos");

  if (pontos.length === 0) {
    lista.innerHTML = "<p>Nenhum ponto cadastrado ainda.</p>";
    return;
  }

  lista.innerHTML = "";

  pontos.forEach((ponto, index) => {
    const linkMaps = `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}`;

    const div = document.createElement("div");
    div.className = "ponto";

    div.innerHTML = `
      <h3>${index + 1}. ${ponto.nomePonto}</h3>
      <p><strong>Horário:</strong> ${ponto.horarioPrevisto}</p>
      <p><strong>Passageiros:</strong> ${ponto.qtdPassageiros}</p>
      <p><strong>Coordenadas:</strong> ${ponto.latitude}, ${ponto.longitude}</p>
      <p><strong>Observação:</strong> ${ponto.observacao || "Sem observação"}</p>

      <div class="acoes">
        <button class="btn-azul" onclick="abrirMaps('${linkMaps}')">Abrir Google Maps</button>
        <button class="btn-vermelho" onclick="removerPonto(${ponto.id})">Remover</button>
      </div>
    `;

    lista.appendChild(div);
  });
}

function abrirMaps(link) {
  window.open(link, "_blank");
}

function removerPonto(id) {
  let pontos = buscarPontos();

  pontos = pontos.filter(ponto => ponto.id !== id);

  pontos = pontos.map((ponto, index) => ({
    ...ponto,
    ordem: index + 1
  }));

  localStorage.setItem("pontosColeta", JSON.stringify(pontos));
  listarPontos();
}

function limparFormularioPonto() {
  document.getElementById("nomePonto").value = "";
  document.getElementById("coordenadas").value = "";
  document.getElementById("qtdPassageiros").value = "";
  document.getElementById("horarioPrevisto").value = "";
  document.getElementById("observacao").value = "";

  if (marcador) {
    mapa.removeLayer(marcador);
    marcador = null;
  }
}

function exportarCSV() {
  const rota = JSON.parse(localStorage.getItem("rotaAtual")) || {};
  const pontos = buscarPontos();

  if (pontos.length === 0) {
    alert("Não existem pontos para exportar.");
    return;
  }

  let csv = "Rota,Data,Horario Inicial,Ordem,Ponto,Horario,Passageiros,Latitude,Longitude,Observacao,Google Maps\n";

  pontos.forEach((ponto, index) => {
    const maps = `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}`;

    csv += `"${rota.nome || ""}","${rota.data || ""}","${rota.horarioInicio || ""}","${index + 1}","${ponto.nomePonto}","${ponto.horarioPrevisto}","${ponto.qtdPassageiros}","${ponto.latitude}","${ponto.longitude}","${ponto.observacao || ""}","${maps}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "rota_pontos_coleta.csv";
  link.click();
}

function limparTudo() {
  const confirmar = confirm("Tem certeza que deseja apagar toda a rota e os pontos?");

  if (confirmar) {
    localStorage.removeItem("rotaAtual");
    localStorage.removeItem("pontosColeta");
    carregarRota();
    listarPontos();
  }
}

function irMotorista() {
  localStorage.setItem("usuarioLogado", "motorista");
  window.location.href = "motorista.html";
}

function sair() {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
}

carregarRota();
listarPontos();
iniciarMapa();
