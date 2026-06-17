const SUPABASE_URL = "https://sjkgbnncfigvgebghecb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gD75EJXrTmgeO9wD-Db7LA_UTxXrHLv";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let mapa;
let marcador;
let rotaAtualId = null;
let modoMapa = "coleta";

verificarLogin();

function setModoMapa(modo) {
  modoMapa = modo;

  const texto = document.getElementById("modoMapaTexto");

  if (modo === "destino") {
    texto.textContent = "Modo atual: destino final";
  } else {
    texto.textContent = "Modo atual: ponto de coleta";
  }
}

function verificarLogin() {
  const usuario = localStorage.getItem("usuarioLogado");

  if (usuario !== "admin") {
    window.location.href = "index.html";
  }
}

async function salvarRota() {
  const nome = document.getElementById("nomeRota").value.trim();
  const data = document.getElementById("dataRota").value;
  const horarioInicio = document.getElementById("horarioInicio").value;
  const destinoNome = document.getElementById("destinoNome").value.trim();
  const destinoCoordenadas = document.getElementById("destinoCoordenadas").value.trim();

  if (!nome || !data || !horarioInicio || !destinoNome || !destinoCoordenadas) {
    alert("Preencha nome da rota, data, horário inicial e destino final.");
    return;
  }

  const partesDestino = destinoCoordenadas.split(",");
  const destinoLatitude = Number(partesDestino[0].trim());
  const destinoLongitude = Number(partesDestino[1].trim());

  const dadosRota = {
    nome,
    data,
    horario_inicio: horarioInicio,
    destino_nome: destinoNome,
    destino_latitude: destinoLatitude,
    destino_longitude: destinoLongitude,
    status: "ativa"
  };

  if (rotaAtualId) {
    const { error } = await supabaseClient
      .from("rotas")
      .update(dadosRota)
      .eq("id", rotaAtualId);

    if (error) {
      alert("Erro ao atualizar rota: " + error.message);
      return;
    }

    alert("Rota atualizada com sucesso!");
  } else {
    const { data: rotaCriada, error } = await supabaseClient
      .from("rotas")
      .insert(dadosRota)
      .select()
      .single();

    if (error) {
      alert("Erro ao criar rota: " + error.message);
      return;
    }

    rotaAtualId = rotaCriada.id;
    localStorage.setItem("rotaAtualId", rotaAtualId);

    alert("Rota criada com sucesso!");
  }

  atualizarTextoRota();
  listarPontos();
}

async function carregarRotaAtual() {
  const rotaIdSalva = localStorage.getItem("rotaAtualId");

  let query = supabaseClient
    .from("rotas")
    .select("*")
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(1);

  if (rotaIdSalva) {
    query = supabaseClient
      .from("rotas")
      .select("*")
      .eq("id", rotaIdSalva)
      .limit(1);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    atualizarTextoRota();
    return;
  }

  const rota = data[0];

  rotaAtualId = rota.id;
  localStorage.setItem("rotaAtualId", rotaAtualId);

  document.getElementById("nomeRota").value = rota.nome || "";
  document.getElementById("dataRota").value = rota.data || "";
  document.getElementById("horarioInicio").value = rota.horario_inicio || "";
  document.getElementById("destinoNome").value = rota.destino_nome || "";

if (rota.destino_latitude && rota.destino_longitude) {
  document.getElementById("destinoCoordenadas").value =
    `${rota.destino_latitude}, ${rota.destino_longitude}`;
}

  atualizarTextoRota();
}

function atualizarTextoRota() {
  const texto = document.getElementById("rotaAtualTexto");

  if (!rotaAtualId) {
    texto.textContent = "Nenhuma rota carregada. Salve os dados da rota antes de adicionar pontos.";
    return;
  }

  texto.textContent = "Rota atual carregada. Os pontos serão salvos nesta rota.";
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
  const coordenada = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  if (modoMapa === "destino") {
    document.getElementById("destinoCoordenadas").value = coordenada;
  } else {
    document.getElementById("coordenadas").value = coordenada;
  }

  if (marcador) {
    mapa.removeLayer(marcador);
  }

  marcador = L.marker([lat, lng]).addTo(mapa);
});
  
async function adicionarPonto() {
  if (!rotaAtualId) {
    alert("Salve primeiro os dados da rota.");
    return;
  }

  const nomePonto = document.getElementById("nomePonto").value.trim();
  const coordenadas = document.getElementById("coordenadas").value.trim();
  const qtdPassageiros = Number(document.getElementById("qtdPassageiros").value);
  const horarioPrevisto = document.getElementById("horarioPrevisto").value;
  const observacao = document.getElementById("observacao").value.trim();

  if (!coordenadas) {
    alert("Selecione um ponto no mapa.");
    return;
  }

  const partes = coordenadas.split(",");
  const latitude = Number(partes[0].trim());
  const longitude = Number(partes[1].trim());

  if (!nomePonto || !latitude || !longitude || !qtdPassageiros || !horarioPrevisto) {
    alert("Preencha nome, ponto no mapa, quantidade e horário.");
    return;
  }

  const { count } = await supabaseClient
    .from("pontos_coleta")
    .select("*", { count: "exact", head: true })
    .eq("rota_id", rotaAtualId);

  const ordem = (count || 0) + 1;

  const { error } = await supabaseClient
    .from("pontos_coleta")
    .insert({
      rota_id: rotaAtualId,
      ordem,
      nome_ponto: nomePonto,
      latitude,
      longitude,
      qtd_passageiros: qtdPassageiros,
      horario_previsto: horarioPrevisto,
      observacao,
      status: "pendente"
    });

  if (error) {
    alert("Erro ao adicionar ponto: " + error.message);
    return;
  }

  limparFormularioPonto();
  listarPontos();
}

async function buscarPontos() {
  if (!rotaAtualId) return [];

  const { data, error } = await supabaseClient
    .from("pontos_coleta")
    .select("*")
    .eq("rota_id", rotaAtualId)
    .order("ordem", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

async function listarPontos() {
  const pontos = await buscarPontos();
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
      <h3>${index + 1}. ${ponto.nome_ponto}</h3>
      <p><strong>Horário:</strong> ${ponto.horario_previsto}</p>
      <p><strong>Passageiros:</strong> ${ponto.qtd_passageiros}</p>
      <p><strong>Coordenadas:</strong> ${ponto.latitude}, ${ponto.longitude}</p>
      <p><strong>Status:</strong> ${traduzirStatus(ponto.status)}</p>
      <p><strong>Observação:</strong> ${ponto.observacao || "Sem observação"}</p>

      <div class="acoes">
        <button class="btn-azul" onclick="abrirMaps('${linkMaps}')">Abrir Google Maps</button>
        <button class="btn-vermelho" onclick="removerPonto('${ponto.id}')">Remover</button>
      </div>
    `;

    lista.appendChild(div);
  });
}

function abrirMaps(link) {
  window.open(link, "_blank");
}

async function removerPonto(id) {
  const confirmar = confirm("Deseja remover este ponto?");

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("pontos_coleta")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Erro ao remover ponto: " + error.message);
    return;
  }

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

async function exportarCSV() {
  const pontos = await buscarPontos();

  if (pontos.length === 0) {
    alert("Não existem pontos para exportar.");
    return;
  }

  const rota = {
    nome: document.getElementById("nomeRota").value,
    data: document.getElementById("dataRota").value,
    horarioInicio: document.getElementById("horarioInicio").value
  };

  let csv = "Rota,Data,Horario Inicial,Ordem,Ponto,Horario,Passageiros,Latitude,Longitude,Status,Observacao,Google Maps\n";

  pontos.forEach((ponto, index) => {
    const maps = `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}`;

    csv += `"${rota.nome}","${rota.data}","${rota.horarioInicio}","${index + 1}","${ponto.nome_ponto}","${ponto.horario_previsto}","${ponto.qtd_passageiros}","${ponto.latitude}","${ponto.longitude}","${ponto.status}","${ponto.observacao || ""}","${maps}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "rota_pontos_coleta.csv";
  link.click();
}

async function limparTudo() {
  if (!rotaAtualId) {
    alert("Nenhuma rota ativa para limpar.");
    return;
  }

  const confirmar = confirm("Tem certeza que deseja apagar todos os pontos desta rota?");

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("pontos_coleta")
    .delete()
    .eq("rota_id", rotaAtualId);

  if (error) {
    alert("Erro ao limpar rota: " + error.message);
    return;
  }

  listarPontos();
}

function traduzirStatus(status) {
  if (status === "coletado") return "Coletado";
  if (status === "ausente") return "Ausente";
  return "Pendente";
}

function irMotorista() {
  window.location.href = "motorista.html";
}

function sair() {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
}

async function iniciarPagina() {
  await carregarRotaAtual();
  iniciarMapa();
  listarPontos();
}

iniciarPagina();


