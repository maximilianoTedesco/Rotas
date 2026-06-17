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
    window.location.href = "index.html";
  }
}

async function carregarRotaMotorista() {
  const { data, error } = await supabaseClient
    .from("rotas")
    .select("*")
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    document.getElementById("rotaInfo").innerHTML = "Erro ao carregar rota.";
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    rotaAtual = null;
    document.getElementById("rotaInfo").innerHTML = "Nenhuma rota ativa encontrada.";
    document.getElementById("proximoPonto").innerHTML = "";
    document.getElementById("listaPontos").innerHTML = `
      <div class="sem-pontos">O ADM ainda não criou uma rota ativa.</div>
    `;
    return;
  }

  rotaAtual = data[0];

  document.getElementById("rotaInfo").innerHTML = `
    <p><strong>Rota:</strong> ${rotaAtual.nome}</p>
    <p><strong>Data:</strong> ${rotaAtual.data}</p>
    <p><strong>Horário inicial:</strong> ${rotaAtual.horario_inicio}</p>
  `;

  listarPontosMotorista();
}

async function buscarPontos() {
  if (!rotaAtual) return [];

  const { data, error } = await supabaseClient
    .from("pontos_coleta")
    .select("*")
    .eq("rota_id", rotaAtual.id)
    .order("ordem", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

async function listarPontosMotorista() {
  const pontos = await buscarPontos();
  const lista = document.getElementById("listaPontos");

  if (pontos.length === 0) {
    document.getElementById("proximoPonto").innerHTML = "";
    lista.innerHTML = `
      <div class="sem-pontos">
        Nenhum ponto de coleta cadastrado pelo ADM.
      </div>
    `;
    return;
  }

  mostrarProximoPonto(pontos);
  mostrarRotaCompleta(pontos);

  lista.innerHTML = "";

  pontos.forEach((ponto, index) => {
    const linkMaps = `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}`;

    const div = document.createElement("div");
    div.className = `ponto ${ponto.status === "coletado" ? "coletado" : ""} ${ponto.status === "ausente" ? "ausente" : ""}`;

    div.innerHTML = `
      <h2>${index + 1}. ${ponto.nome_ponto}</h2>
      <p><strong>Horário:</strong> ${ponto.horario_previsto}</p>
      <p><strong>Passageiros:</strong> ${ponto.qtd_passageiros}</p>
      <p><strong>Coordenadas:</strong> ${ponto.latitude}, ${ponto.longitude}</p>
      <p><strong>Observação:</strong> ${ponto.observacao || "Sem observação"}</p>
      <span class="status">${traduzirStatus(ponto.status)}</span>

      <div class="botoes">
        <button class="btn-maps" onclick="abrirMaps('${linkMaps}')">Abrir no Google Maps</button>
        <button class="btn-verde" onclick="alterarStatus('${ponto.id}', 'coletado')">Coletado</button>
        <button class="btn-vermelho" onclick="alterarStatus('${ponto.id}', 'ausente')">Ausente</button>
      </div>
    `;

    lista.appendChild(div);
  });
}

function mostrarProximoPonto(pontos) {
  const proximo = pontos.find(ponto => ponto.status === "pendente");
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

  const linkMaps = `https://www.google.com/maps/dir/?api=1&destination=${proximo.latitude},${proximo.longitude}`;

  box.innerHTML = `
    <div class="proximo-box">
      <h2>Próximo ponto</h2>
      <p><strong>${proximo.nome_ponto}</strong></p>
      <p><strong>Horário:</strong> ${proximo.horario_previsto}</p>
      <p><strong>Passageiros:</strong> ${proximo.qtd_passageiros}</p>

      <div class="botoes">
        <button class="btn-maps" onclick="abrirMaps('${linkMaps}')">Ir para o próximo ponto</button>
      </div>
    </div>
  `;
}

function abrirMaps(link) {
  window.open(link, "_blank");
}

async function alterarStatus(id, novoStatus) {
  const { error } = await supabaseClient
    .from("pontos_coleta")
    .update({ status: novoStatus })
    .eq("id", id);

  if (error) {
    alert("Erro ao alterar status: " + error.message);
    return;
  }

  listarPontosMotorista();
}

function traduzirStatus(status) {
  if (status === "coletado") return "COLETADO";
  if (status === "ausente") return "AUSENTE";
  return "PENDENTE";
}

async function sair() {
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}

function mostrarRotaCompleta(pontos) {
  const box = document.getElementById("rotaCompletaBox");

  if (
    !rotaAtual ||
    !rotaAtual.destino_latitude ||
    !rotaAtual.destino_longitude ||
    pontos.length === 0
  ) {
    box.innerHTML = "";
    return;
  }

  const primeiroPonto = pontos[0];

  const origem = `${primeiroPonto.latitude},${primeiroPonto.longitude}`;
  const destino = `${rotaAtual.destino_latitude},${rotaAtual.destino_longitude}`;

  const waypoints = pontos
    .slice(1)
    .map(ponto => `${ponto.latitude},${ponto.longitude}`)
    .join("|");

  let linkRotaCompleta =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origem}` +
    `&destination=${destino}`;

  if (waypoints) {
    linkRotaCompleta += `&waypoints=${waypoints}`;
  }

  box.innerHTML = `
    <div class="proximo-box">
      <h2>Rota completa</h2>
      <p><strong>Destino final:</strong> ${rotaAtual.destino_nome || "Não informado"}</p>
      <p><strong>Total de paradas:</strong> ${pontos.length}</p>

      <div class="botoes">
        <button class="btn-maps" onclick="abrirMaps('${linkRotaCompleta}')">
          Abrir rota completa no Google Maps
        </button>
      </div>
    </div>
  `;
}

async function fazerLogin() {

    const usuario =
        document.getElementById("usuario").value;

    const senha =
        document.getElementById("senha").value;

    const { data, error } = await supabaseClient
        .from("usuarios")
        .select("*")
        .eq("usuario", usuario)
        .eq("senha", senha)
        .eq("ativo", true)
        .single();

    if(error || !data){
        alert("Usuário ou senha inválidos");
        return;
    }

    localStorage.setItem(
        "usuarioLogado",
        data.perfil
    );

    if(data.perfil === "admin"){
        window.location.href = "admin.html";
    }

    if(data.perfil === "motorista"){
        window.location.href = "motorista.html";
    }
}
