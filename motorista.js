const SUPABASE_URL = "https://sjkgbnncfigvgebghecb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gD75EJXrTmgeO9wD-Db7LA_UTxXrHLv";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let rotaAtual = null;

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
      <p><strong>Destino final:</strong> ${rotaAtual.destino_nome || "Não informado"}</p>
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
  const lista = document.getElementById("listaPontos");

  if (pontos.length === 0) {
    document.getElementById("proximoPonto").innerHTML = "";

    document.getElementById("rotaCompletaBox").innerHTML = "";

    lista.innerHTML = `
      <div class="sem-pontos">
        Nenhum ponto de coleta cadastrado nesta rota.
      </div>
    `;

    return;
  }

  mostrarProximoPonto(pontos);
  mostrarRotaCompleta(pontos);

  lista.innerHTML = "";

  pontos.forEach((item, index) => {
    const ponto = item.pontos_base;

    if (!ponto) return;

    const linkMaps = criarLinkProximaParada(ponto.latitude, ponto.longitude);

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
      <p><strong>Coordenadas:</strong> ${ponto.latitude}, ${ponto.longitude}</p>
      <p><strong>Observação:</strong> ${item.observacao || "Sem observação"}</p>

      <span class="status">${traduzirStatus(item.status)}</span>

      <div class="botoes">
        <button class="btn-maps" onclick="abrirMaps('${linkMaps}')">
          Abrir no Google Maps
        </button>

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

function mostrarProximoPonto(pontos) {
  const proximo = pontos.find((item) => item.status === "pendente");
  const box = document.getElementById("proximoPonto");

  if (!proximo) {
    box.innerHTML = `
      <div class="proximo-box">
        <h2>Rota finalizada</h2>
        <p>Todos os pontos foram marcados como coletados ou ausentes.</p>

        <div class="botoes">
          <button class="btn-maps" onclick="abrirDestinoFinal()">
            Ir para o destino final
          </button>
        </div>
      </div>
    `;

    return;
  }

  const ponto = proximo.pontos_base;

  if (!ponto) {
    box.innerHTML = "";
    return;
  }

  const linkMaps = criarLinkProximaParada(ponto.latitude, ponto.longitude);

  box.innerHTML = `
    <div class="proximo-box destaque-proximo">
      <h2>Próximo ponto</h2>

      <p><strong>${ponto.nome}</strong></p>
      <p><strong>Horário:</strong> ${formatarHora(proximo.horario_previsto)}</p>
      <p><strong>Passageiros:</strong> ${proximo.qtd_passageiros || 0}</p>
      <p><strong>Endereço:</strong> ${ponto.endereco || "Não informado"}</p>
      <p><strong>Observação:</strong> ${proximo.observacao || "Sem observação"}</p>

      <div class="botoes">
        <button class="btn-maps" onclick="abrirMaps('${linkMaps}')">
          Ir para o próximo ponto
        </button>

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

  const primeiroPonto = pontos[0];
  const ultimoPonto = pontos[pontos.length - 1];

  const origem = `${primeiroPonto.latitude},${primeiroPonto.longitude}`;
  const destino = `${ultimoPonto.latitude},${ultimoPonto.longitude}`;

  const waypoints = pontos
    .slice(1, -1)
    .map((ponto) => `${ponto.latitude},${ponto.longitude}`)
    .join("|");

  let linkRotaCompleta =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origem}` +
    `&destination=${destino}`;

  if (waypoints) {
    linkRotaCompleta += `&waypoints=${waypoints}`;
  }

  box.innerHTML = `
    <div class="card destaque">
      <h2>Rota completa</h2>
      <p><strong>Início:</strong> ${primeiroPonto.nome_ponto}</p>
      <p><strong>Final:</strong> ${ultimoPonto.nome_ponto}</p>
      <p><strong>Total de paradas:</strong> ${pontos.length}</p>
      <button onclick="abrirMaps('${linkRotaCompleta}')">
        Abrir rota completa no Google Maps
      </button>
    </div>
  `;
}

function criarLinkProximaParada(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

function criarLinkRotaCompleta(pontos) {
  const primeiroPonto = pontos[0].pontos_base;

  const origem = `${primeiroPonto.latitude},${primeiroPonto.longitude}`;
  const destino = `${rotaAtual.destino_latitude},${rotaAtual.destino_longitude}`;

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

  return link;
}

function abrirDestinoFinal() {
  if (!rotaAtual || !rotaAtual.destino_latitude || !rotaAtual.destino_longitude) {
    alert("Destino final não encontrado.");
    return;
  }

  const link =
    `https://www.google.com/maps/dir/?api=1` +
    `&destination=${rotaAtual.destino_latitude},${rotaAtual.destino_longitude}` +
    `&travelmode=driving`;

  abrirMaps(link);
}

function abrirMaps(link) {
  window.open(link, "_blank");
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
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}
