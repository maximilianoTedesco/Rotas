const SUPABASE_URL = "COLE_AQUI_SUA_SUPABASE_URL";
const SUPABASE_KEY = "COLE_AQUI_SUA_SUPABASE_ANON_KEY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let rotaAtual = null;

verificarLogin();

function verificarLogin() {
  const usuario = localStorage.getItem("usuarioLogado");

  if (usuario !== "motorista" && usuario !== "admin") {
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

function sair() {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
}

carregarRotaMotorista();
