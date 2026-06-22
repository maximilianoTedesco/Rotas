const SUPABASE_URL = "https://sjkgbnncfigvgebghecb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gD75EJXrTmgeO9wD-Db7LA_UTxXrHLv";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let rotaAtual = null;
let mapaMotorista = null;
let controleRotaMotorista = null;

let pontosCache = [];
let navegacaoAtiva = false;
let watchIdMotorista = null;
let marcadorMotorista = null;
let circuloPrecisao = null;
let ultimaPosicaoMotorista = null;

verificarLogin();

async function verificarLogin() {
  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "index.html";
    return;
  }

  const userId = sessionData.session.user.id;

  const { data: perfil, error } = await supabaseClient
    .from("perfis")
    .select("*")
    .eq("id", userId)
    .eq("ativo", true)
    .single();

  if (error || !perfil || !["motorista", "admin"].includes(perfil.perfil)) {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = "index.html";
    return;
  }

  await carregarRotaMotorista();
}

async function carregarRotaMotorista() {
  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "index.html";
    return;
  }

  const motoristaId = sessionData.session.user.id;

  const { data, error } = await supabaseClient
    .from("rotas")
    .select("*")
    .eq("status", "ativa")
    .eq("motorista_id", motoristaId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    document.getElementById("rotaInfo").innerHTML = "Erro ao carregar rota.";
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    rotaAtual = null;

    document.getElementById("rotaInfo").innerHTML =
      "Nenhuma rota ativa atribuída para este motorista.";

    document.getElementById("proximoPonto").innerHTML = "";
    document.getElementById("rotaCompletaBox").innerHTML = "";

    document.getElementById("listaPontos").innerHTML = `
      <div class="sem-pontos">
        O ADM ainda não atribuiu uma rota ativa para este motorista.
      </div>
    `;

    return;
  }

  rotaAtual = data[0];

  document.getElementById("rotaInfo").innerHTML = `
    <p><strong>Rota:</strong> ${rotaAtual.nome}</p>
    <p><strong>Data:</strong> ${formatarData(rotaAtual.data)}</p>
    <p><strong>Horário inicial:</strong> ${formatarHora(rotaAtual.horario_inicio)}</p>
    <p><strong>Destino final:</strong> O último ponto da rota</p>
  `;

  await listarPontosMotorista();
}

async function buscarPontos() {
  if (!rotaAtual) return [];

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
    .eq("rota_id", rotaAtual.id)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pontos:", error);
    return [];
  }

  return data || [];
}

async function listarPontosMotorista() {
  const pontos = await buscarPontos();
  pontosCache = pontos;

  const lista = document.getElementById("listaPontos");

  if (pontos.length === 0) {
    document.getElementById("proximoPonto").innerHTML = "";
    document.getElementById("rotaCompletaBox").innerHTML = "";

    lista.innerHTML = `
      <div class="sem-pontos">
        Nenhum ponto de coleta cadastrado nesta rota.
      </div>
    `;

    limparMapaMotorista();
    return;
  }

  mostrarProximoPonto(pontos);
  mostrarRotaCompleta(pontos);
  desenharRotaMotorista(pontos);

  lista.innerHTML = "";

  pontos.forEach((item, index) => {
    const ponto = item.pontos_base;
    if (!ponto) return;

    const div = document.createElement("div");

    div.className = `
      ponto
      ${item.status === "coletado" ? "coletado" : ""}
      ${item.status === "ausente" ? "ausente" : ""}
    `;

    div.innerHTML = `
      <h2>${index + 1}. ${ponto.nome}</h2>

      <p><strong>Horário:</strong> ${formatarHora(item.horario_previsto)}</p>
      <p><strong>Passageiros:</strong> ${item.qtd_passageiros || 0}</p>
      <p><strong>Endereço:</strong> ${ponto.endereco || "Não informado"}</p>
      <p><strong>Observação:</strong> ${item.observacao || "Sem observação"}</p>

      <span class="status">${traduzirStatus(item.status)}</span>

      <div class="botoes">
        <button class="btn-verde" onclick="alterarStatus('${item.id}', 'coletado')">
          Coletado
        </button>

        <button class="btn-vermelho" onclick="alterarStatus('${item.id}', 'ausente')">
          Ausente
        </button>
      </div>
    `;

    lista.appendChild(div);
  });
}

function iniciarMapaMotorista() {
  if (mapaMotorista) return;

  mapaMotorista = L.map("mapaMotorista").setView([37.1366, -8.5377], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapaMotorista);
}

function limparMapaMotorista() {
  if (controleRotaMotorista && mapaMotorista) {
    mapaMotorista.removeControl(controleRotaMotorista);
    controleRotaMotorista = null;
  }
}

function desenharRotaMotorista(pontos) {
  if (!pontos || pontos.length < 2) return;

  iniciarMapaMotorista();

  setTimeout(() => {
    if (mapaMotorista) {
      mapaMotorista.invalidateSize();
    }
  }, 300);

  limparMapaMotorista();

  const pontosValidos = pontos.filter((item) => {
    const ponto = item.pontos_base;
    return ponto && ponto.latitude && ponto.longitude;
  });

  if (pontosValidos.length < 2) return;

  const waypoints = pontosValidos.map((item) => {
    const ponto = item.pontos_base;
    return L.latLng(Number(ponto.latitude), Number(ponto.longitude));
  });

  controleRotaMotorista = L.Routing.control({
    waypoints,
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
    createMarker: function (i, waypoint) {
      const item = pontosValidos[i];
      const ponto = item.pontos_base;

      return L.marker(waypoint.latLng).bindPopup(`
        <strong>${i + 1}. ${ponto.nome}</strong><br>
        ${ponto.endereco || "Endereço não informado"}<br>
        Horário: ${formatarHora(item.horario_previsto)}
      `);
    },
    lineOptions: {
      styles: [
        {
          weight: 6,
          opacity: 0.9
        }
      ]
    }
  }).addTo(mapaMotorista);
}

function mostrarProximoPonto(pontos) {
  const proximo = pontos.find((item) => item.status === "pendente");
  const box = document.getElementById("proximoPonto");

  if (!proximo) {
    box.innerHTML = `
      <div class="proximo-box">
        <h2>Rota finalizada</h2>
        <p>Todos os pontos foram marcados como coletados ou ausentes.</p>
      </div>
    `;
    return;
  }

  const ponto = proximo.pontos_base;

  if (!ponto) {
    box.innerHTML = "";
    return;
  }

  let distanciaHtml = "";

  if (ultimaPosicaoMotorista) {
    const distancia = calcularDistanciaMetros(
      ultimaPosicaoMotorista.latitude,
      ultimaPosicaoMotorista.longitude,
      Number(ponto.latitude),
      Number(ponto.longitude)
    );

    distanciaHtml = `
      <p><strong>Distância até o ponto:</strong> ${formatarDistancia(distancia)}</p>
      ${
        distancia <= 80
          ? `<p><strong>✅ Você está próximo deste ponto.</strong></p>`
          : ""
      }
    `;
  }

  box.innerHTML = `
    <div class="proximo-box destaque-proximo">
      <h2>${navegacaoAtiva ? "Navegando para" : "Próximo ponto"}</h2>

      <p><strong>${ponto.nome}</strong></p>
      <p><strong>Horário:</strong> ${formatarHora(proximo.horario_previsto)}</p>
      <p><strong>Passageiros:</strong> ${proximo.qtd_passageiros || 0}</p>
      <p><strong>Endereço:</strong> ${ponto.endereco || "Não informado"}</p>
      <p><strong>Observação:</strong> ${proximo.observacao || "Sem observação"}</p>
      ${distanciaHtml}

      <div class="botoes">
        <button class="btn-verde" onclick="alterarStatus('${proximo.id}', 'coletado')">
          Marcar coletado e avançar
        </button>

        <button class="btn-vermelho" onclick="alterarStatus('${proximo.id}', 'ausente')">
          Marcar ausente e avançar
        </button>
      </div>
    </div>
  `;
}

function mostrarRotaCompleta(pontos) {
  const box = document.getElementById("rotaCompletaBox");

  if (!rotaAtual || pontos.length < 2) {
    box.innerHTML = "";
    return;
  }

  const primeiroItem = pontos[0];
  const ultimoItem = pontos[pontos.length - 1];

  const primeiroPonto = primeiroItem.pontos_base;
  const ultimoPonto = ultimoItem.pontos_base;

  if (!primeiroPonto || !ultimoPonto) {
    box.innerHTML = "";
    return;
  }

  const totalPassageiros = pontos.reduce((total, item) => {
    return total + Number(item.qtd_passageiros || 0);
  }, 0);

  box.innerHTML = `
    <div class="card destaque">
      <h2>Resumo da rota</h2>
      <p><strong>Início:</strong> ${primeiroPonto.nome}</p>
      <p><strong>Final:</strong> ${ultimoPonto.nome}</p>
      <p><strong>Total de paradas:</strong> ${pontos.length}</p>
      <p><strong>Total de passageiros:</strong> ${totalPassageiros}</p>

      <div class="botoes">
        <button class="btn-maps" onclick="iniciarNavegacao()">
          Iniciar navegação
        </button>

        <button class="btn-cinza" onclick="centralizarMotorista()">
          Centralizar em mim
        </button>

        <button class="btn-vermelho" onclick="pararNavegacao()">
          Parar navegação
        </button>
      </div>
    </div>
  `;
}

function iniciarNavegacao() {
  if (!navigator.geolocation) {
    alert("Este dispositivo não suporta localização.");
    return;
  }

  iniciarMapaMotorista();

  navegacaoAtiva = true;

  watchIdMotorista = navigator.geolocation.watchPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const precisao = position.coords.accuracy;

      ultimaPosicaoMotorista = {
        latitude,
        longitude,
        precisao
      };

      atualizarMarcadorMotorista(latitude, longitude, precisao);

      mapaMotorista.setView([latitude, longitude], 17);

      mostrarProximoPonto(pontosCache);
    },
    (error) => {
      console.error(error);

      if (error.code === 1) {
        alert("Permissão de localização negada. Ative a localização no navegador.");
      } else {
        alert("Não foi possível obter sua localização.");
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    }
  );
}

function pararNavegacao() {
  navegacaoAtiva = false;

  if (watchIdMotorista !== null) {
    navigator.geolocation.clearWatch(watchIdMotorista);
    watchIdMotorista = null;
  }

  alert("Navegação encerrada.");
}

function centralizarMotorista() {
  if (!mapaMotorista || !ultimaPosicaoMotorista) {
    alert("Inicie a navegação primeiro para localizar o motorista.");
    return;
  }

  mapaMotorista.setView(
    [ultimaPosicaoMotorista.latitude, ultimaPosicaoMotorista.longitude],
    17
  );
}

function atualizarMarcadorMotorista(latitude, longitude, precisao) {
  const posicao = [latitude, longitude];

  if (!marcadorMotorista) {
    marcadorMotorista = L.marker(posicao).addTo(mapaMotorista);
    marcadorMotorista.bindPopup("Você está aqui");
  } else {
    marcadorMotorista.setLatLng(posicao);
  }

  if (!circuloPrecisao) {
    circuloPrecisao = L.circle(posicao, {
      radius: precisao
    }).addTo(mapaMotorista);
  } else {
    circuloPrecisao.setLatLng(posicao);
    circuloPrecisao.setRadius(precisao);
  }
}

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = grausParaRad(lat2 - lat1);
  const dLon = grausParaRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(grausParaRad(lat1)) *
      Math.cos(grausParaRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function grausParaRad(valor) {
  return valor * Math.PI / 180;
}

function formatarDistancia(metros) {
  if (metros < 1000) {
    return `${Math.round(metros)} m`;
  }

  return `${(metros / 1000).toFixed(1)} km`;
}

async function alterarStatus(id, novoStatus) {
  const { error } = await supabaseClient
    .from("rota_pontos")
    .update({ status: novoStatus })
    .eq("id", id);

  if (error) {
    alert("Erro ao alterar status: " + error.message);
    return;
  }

  await listarPontosMotorista();
}

function traduzirStatus(status) {
  if (status === "coletado") return "COLETADO";
  if (status === "ausente") return "AUSENTE";
  return "PENDENTE";
}

function formatarData(data) {
  if (!data) return "Não informada";

  const partes = data.split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHora(hora) {
  if (!hora) return "Não informado";

  return hora.slice(0, 5);
}

async function sair() {
  pararNavegacao();
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}
