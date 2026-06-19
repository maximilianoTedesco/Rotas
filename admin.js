const SUPABASE_URL = "https://sjkgbnncfigvgebghecb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gD75EJXrTmgeO9wD-Db7LA_UTxXrHLv";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let mapa;
let marcador;
let rotaAtualId = null;
let modoSelecao = "ponto";

async function verificarLogin() {
  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "index.html";
    return false;
  }

  const userId = sessionData.session.user.id;

  const { data: perfil, error } = await supabaseClient
    .from("perfis")
    .select("*")
    .eq("id", userId)
    .eq("ativo", true)
    .single();

  if (error || !perfil || perfil.perfil !== "admin") {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = "index.html";
    return false;
  }

  localStorage.setItem("usuarioLogado", "admin");
  return true;
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
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    const coordenada = `${lat}, ${lng}`;

    if (modoSelecao === "destino") {
      document.getElementById("destinoCoordenadas").value = coordenada;
      modoSelecao = "ponto";
    } else {
      document.getElementById("coordenadasPontoBase").value = coordenada;
    }

    if (marcador) {
      mapa.removeLayer(marcador);
    }

    marcador = L.marker([lat, lng]).addTo(mapa);
  });
}

function ativarModoDestino() {
  modoSelecao = "destino";
  alert("Agora clique no mapa para selecionar o destino final da rota.");
}

async function salvarPontoBase() {
  const nome = document.getElementById("nomePontoBase").value.trim();
  const endereco = document.getElementById("enderecoPontoBase").value.trim();
  const coordenadas = document.getElementById("coordenadasPontoBase").value.trim();

  if (!nome || !coordenadas) {
    alert("Preencha o nome e selecione o ponto no mapa.");
    return;
  }

  const partes = coordenadas.split(",");
  const latitude = Number(partes[0].trim());
  const longitude = Number(partes[1].trim());

  const { error } = await supabaseClient
    .from("pontos_base")
    .insert({
      nome,
      endereco,
      latitude,
      longitude,
      ativo: true
    });

  if (error) {
    alert("Erro ao salvar ponto fixo: " + error.message);
    return;
  }

  document.getElementById("nomePontoBase").value = "";
  document.getElementById("enderecoPontoBase").value = "";
  document.getElementById("coordenadasPontoBase").value = "";

  if (marcador) {
    mapa.removeLayer(marcador);
    marcador = null;
  }

  await carregarPontosBase();
  alert("Ponto fixo cadastrado com sucesso!");
}

async function carregarPontosBase() {
  const { data, error } = await supabaseClient
    .from("pontos_base")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pontos fixos:", error);
    return;
  }

  const lista = document.getElementById("listaPontosBase");
  const select = document.getElementById("selectPontoBase");

  lista.innerHTML = "";
  select.innerHTML = `<option value="">Selecione um ponto</option>`;

  if (!data || data.length === 0) {
    lista.innerHTML = "<p>Nenhum ponto fixo cadastrado ainda.</p>";
    return;
  }

  data.forEach((ponto) => {
    const option = document.createElement("option");
    option.value = ponto.id;
    option.textContent = ponto.nome;
    select.appendChild(option);

    const div = document.createElement("div");
    div.className = "ponto";

    div.innerHTML = `
      <h3>${ponto.nome}</h3>
      <p><strong>Endereço:</strong> ${ponto.endereco || "Não informado"}</p>
      <p><strong>Coordenadas:</strong> ${ponto.latitude}, ${ponto.longitude}</p>

      <div class="acoes">
        <button class="btn-vermelho" onclick="desativarPontoBase('${ponto.id}')">
          Desativar
        </button>
      </div>
    `;

    lista.appendChild(div);
  });
}

async function desativarPontoBase(id) {
  const confirmar = confirm("Deseja desativar este ponto fixo?");

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("pontos_base")
    .update({ ativo: false })
    .eq("id", id);

  if (error) {
    alert("Erro ao desativar ponto: " + error.message);
    return;
  }

  await carregarPontosBase();
}

async function salvarRota() {
  const nome = document.getElementById("nomeRota").value.trim();
  const data = document.getElementById("dataRota").value;
  const horarioInicio = document.getElementById("horarioInicio").value;
  const destinoNome = document.getElementById("destinoNome").value.trim();
  const destinoCoordenadas = document.getElementById("destinoCoordenadas").value.trim();

  if (!nome || !data || !horarioInicio || !destinoNome || !destinoCoordenadas) {
    alert("Preencha todos os dados da rota.");
    return;
  }

  const partes = destinoCoordenadas.split(",");
  const destinoLatitude = Number(partes[0].trim());
  const destinoLongitude = Number(partes[1].trim());

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
  await listarPontosRota();
}

async function carregarRotaAtual() {
  const rotaIdSalva = localStorage.getItem("rotaAtualId");

  let query;

  if (rotaIdSalva) {
    query = supabaseClient
      .from("rotas")
      .select("*")
      .eq("id", rotaIdSalva)
      .limit(1);
  } else {
    query = supabaseClient
      .from("rotas")
      .select("*")
      .eq("status", "ativa")
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao carregar rota:", error);
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
    texto.textContent = "Nenhuma rota carregada. Salve a rota antes de adicionar pontos.";
    return;
  }

  texto.textContent = "Rota carregada. Agora adicione pontos cadastrados dentro dela.";
}

async function adicionarPontoNaRota() {
  if (!rotaAtualId) {
    alert("Salve primeiro a rota.");
    return;
  }

  const pontoBaseId = document.getElementById("selectPontoBase").value;
  const horarioPrevisto = document.getElementById("horarioPrevisto").value;
  const qtdPassageiros = Number(document.getElementById("qtdPassageiros").value || 0);
  const observacao = document.getElementById("observacao").value.trim();

  if (!pontoBaseId || !horarioPrevisto) {
    alert("Selecione um ponto e informe o horário previsto.");
    return;
  }

  const { count } = await supabaseClient
    .from("rota_pontos")
    .select("*", { count: "exact", head: true })
    .eq("rota_id", rotaAtualId);

  const ordem = (count || 0) + 1;

  const { error } = await supabaseClient
    .from("rota_pontos")
    .insert({
      rota_id: rotaAtualId,
      ponto_base_id: pontoBaseId,
      ordem,
      horario_previsto: horarioPrevisto,
      qtd_passageiros: qtdPassageiros,
      observacao,
      status: "pendente"
    });

  if (error) {
    alert("Erro ao adicionar ponto na rota: " + error.message);
    return;
  }

  document.getElementById("selectPontoBase").value = "";
  document.getElementById("horarioPrevisto").value = "";
  document.getElementById("qtdPassageiros").value = "";
  document.getElementById("observacao").value = "";

  await listarPontosRota();
}

async function buscarPontosRota() {
  if (!rotaAtualId) return [];

  const { data, error } = await supabaseClient
    .from("rota_pontos")
    .select(`
      *,
      pontos_base (
        nome,
        endereco,
        latitude,
        longitude
      )
    `)
    .eq("rota_id", rotaAtualId)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pontos da rota:", error);
    return [];
  }

  return data || [];
}

async function listarPontosRota() {
  const pontos = await buscarPontosRota();
  const lista = document.getElementById("listaPontosRota");

  lista.innerHTML = "";

  if (pontos.length === 0) {
    lista.innerHTML = "<p>Nenhum ponto adicionado nesta rota ainda.</p>";
    return;
  }

  pontos.forEach((item, index) => {
    const ponto = item.pontos_base;

    const linkMaps =
      `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}&travelmode=driving`;

    const div = document.createElement("div");
    div.className = "ponto";

    div.innerHTML = `
      <h3>${index + 1}. ${ponto.nome}</h3>
      <p><strong>Horário:</strong> ${item.horario_previsto || "Não informado"}</p>
      <p><strong>Passageiros:</strong> ${item.qtd_passageiros || 0}</p>
      <p><strong>Endereço:</strong> ${ponto.endereco || "Não informado"}</p>
      <p><strong>Coordenadas:</strong> ${ponto.latitude}, ${ponto.longitude}</p>
      <p><strong>Status:</strong> ${traduzirStatus(item.status)}</p>
      <p><strong>Observação:</strong> ${item.observacao || "Sem observação"}</p>

      <div class="acoes">
        <button class="btn-azul" onclick="abrirMaps('${linkMaps}')">
          Abrir Google Maps
        </button>

        <button class="btn-cinza" onclick="moverPonto('${item.id}', ${item.ordem}, 'cima')">
          Subir
        </button>

        <button class="btn-cinza" onclick="moverPonto('${item.id}', ${item.ordem}, 'baixo')">
          Descer
        </button>

        <button class="btn-vermelho" onclick="removerPontoDaRota('${item.id}')">
          Remover
        </button>
      </div>
    `;

    lista.appendChild(div);
  });
}

async function moverPonto(id, ordemAtual, direcao) {
  const pontos = await buscarPontosRota();

  const atual = pontos.find((p) => p.id === id);
  const alvo = pontos.find((p) =>
    direcao === "cima"
      ? p.ordem === ordemAtual - 1
      : p.ordem === ordemAtual + 1
  );

  if (!atual || !alvo) return;

  await supabaseClient
    .from("rota_pontos")
    .update({ ordem: alvo.ordem })
    .eq("id", atual.id);

  await supabaseClient
    .from("rota_pontos")
    .update({ ordem: atual.ordem })
    .eq("id", alvo.id);

  await listarPontosRota();
}

async function removerPontoDaRota(id) {
  const confirmar = confirm("Deseja remover este ponto da rota?");

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("rota_pontos")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Erro ao remover ponto da rota: " + error.message);
    return;
  }

  await reorganizarOrdem();
  await listarPontosRota();
}

async function reorganizarOrdem() {
  const pontos = await buscarPontosRota();

  for (let i = 0; i < pontos.length; i++) {
    await supabaseClient
      .from("rota_pontos")
      .update({ ordem: i + 1 })
      .eq("id", pontos[i].id);
  }
}

async function abrirRotaCompleta() {
  const pontos = await buscarPontosRota();

  if (pontos.length === 0) {
    alert("Adicione pontos na rota primeiro.");
    return;
  }

  const destinoCoordenadas = document.getElementById("destinoCoordenadas").value.trim();

  if (!destinoCoordenadas) {
    alert("Informe o destino final da rota.");
    return;
  }

  const destino = destinoCoordenadas.replace(" ", "");
  const primeiro = pontos[0].pontos_base;

  const origem = `${primeiro.latitude},${primeiro.longitude}`;

  const waypoints = pontos
    .slice(1)
    .map((item) => `${item.pontos_base.latitude},${item.pontos_base.longitude}`)
    .join("|");

  let link =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origem}` +
    `&destination=${destino}` +
    `&travelmode=driving`;

  if (waypoints) {
    link += `&waypoints=${waypoints}`;
  }

  abrirMaps(link);
}

function abrirMaps(link) {
  window.open(link, "_blank");
}

async function limparRotaAtual() {
  if (!rotaAtualId) {
    alert("Nenhuma rota carregada.");
    return;
  }

  const confirmar = confirm("Deseja remover todos os pontos desta rota?");

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("rota_pontos")
    .delete()
    .eq("rota_id", rotaAtualId);

  if (error) {
    alert("Erro ao limpar rota: " + error.message);
    return;
  }

  await listarPontosRota();
}

function traduzirStatus(status) {
  if (status === "coletado") return "Coletado";
  if (status === "ausente") return "Ausente";
  return "Pendente";
}

function irMotorista() {
  window.location.href = "motorista.html";
}

async function sair() {
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}

async function iniciarPagina() {
  const autorizado = await verificarLogin();

  if (!autorizado) return;

  iniciarMapa();
  await carregarPontosBase();
  await carregarRotaAtual();
  await listarPontosRota();
}

iniciarPagina();
