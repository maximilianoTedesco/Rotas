const SUPABASE_URL = "https://sjkgbnncfigvgebghecb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gD75EJXrTmgeO9wD-Db7LA_UTxXrHLv";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let mapa;
let marcador;
let rotaAtualId = null;
let modoSelecao = "ponto";

function textoSeguro(valor) {
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nomePainel(id) {
  const nomes = {
    moduloCadastrarMotorista: "Cadastrar motorista",
    moduloGerenciarMotoristas: "Gerenciar motoristas",
    moduloCadastrarPonto: "Cadastrar ponto fixo",
    moduloPontosCadastrados: "Pontos cadastrados",
    moduloCriarRota: "Criar rota",
    moduloAdicionarPontoRota: "Adicionar pontos",
    moduloRotaMontada: "Rota montada",
    moduloGerenciarRotas: "Gerenciar rotas"
  };

  return nomes[id] || "Painel";
}

function atualizarEstadoVisualPainel(idAberto) {
  const texto = document.getElementById("painelAtualTexto");

  if (texto) {
    texto.textContent = idAberto
      ? `Painel aberto: ${nomePainel(idAberto)}`
      : "Nenhum painel aberto";
  }

  document.querySelectorAll(".opcao-card").forEach((botao) => {
    botao.classList.toggle(
      "ativo",
      botao.dataset.painel === idAberto
    );
  });

  document.querySelectorAll(".modulo-card").forEach((card) => {
    const conteudo = card.querySelector(".modulo-conteudo");

    card.classList.toggle(
      "ativo",
      conteudo && conteudo.id === idAberto
    );
  });
}

function abrirPainel(id) {
  document.querySelectorAll(".modulo-conteudo").forEach((conteudo) => {
    conteudo.classList.remove("ativo");
  });

  const elemento = document.getElementById(id);

  if (!elemento) return;

  elemento.classList.add("ativo");

  atualizarEstadoVisualPainel(id);

  setTimeout(() => {
    if (mapa) {
      mapa.invalidateSize();
    }
  }, 300);
}

function toggleModulo(id) {
  const elemento = document.getElementById(id);

  if (!elemento) return;

  if (elemento.classList.contains("ativo")) {
    elemento.classList.remove("ativo");
    atualizarEstadoVisualPainel(null);
    return;
  }

  abrirPainel(id);
}

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

async function criarMotorista() {
  const nome = document.getElementById("nomeMotorista").value.trim();
  const email = document.getElementById("emailMotorista").value.trim();
  const senha = document.getElementById("senhaMotorista").value.trim();

  if (!nome || !email || !senha) {
    alert("Preencha nome, e-mail e senha do motorista.");
    return;
  }

  if (senha.length < 6) {
    alert("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  const resposta = await fetch("/api/criar-motorista", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      nome,
      email,
      senha
    })
  });

  const resultado = await resposta.json();

  if (!resposta.ok) {
    alert("Erro ao criar motorista: " + (resultado.error || "erro desconhecido"));
    return;
  }

  alert("Motorista criado com sucesso!");

  document.getElementById("nomeMotorista").value = "";
  document.getElementById("emailMotorista").value = "";
  document.getElementById("senhaMotorista").value = "";

  await carregarMotoristas();
  await listarMotoristas();
}

async function carregarMotoristas() {
  const { data, error } = await supabaseClient
    .from("perfis")
    .select("id, nome, email, perfil, ativo")
    .eq("perfil", "motorista")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar motoristas:", error);
    alert("Erro ao carregar motoristas: " + error.message);
    return;
  }

  const select = document.getElementById("motoristaRota");

  if (!select) return;

  const motoristaSelecionado = select.value;

  select.innerHTML = `<option value="">Selecione o motorista</option>`;

  if (!data || data.length === 0) {
    select.innerHTML += `<option value="">Nenhum motorista ativo cadastrado</option>`;
    return;
  }

  data.forEach((motorista) => {
    const option = document.createElement("option");
    option.value = motorista.id;
    option.textContent = motorista.nome || motorista.email || "Motorista";
    select.appendChild(option);
  });

  if (motoristaSelecionado) {
    select.value = motoristaSelecionado;
  }
}

async function listarMotoristas() {
  const { data, error } = await supabaseClient
    .from("perfis")
    .select("id, nome, email, perfil, ativo")
    .eq("perfil", "motorista")
    .order("nome", { ascending: true });

  const lista = document.getElementById("listaMotoristas");

  if (!lista) return;

  lista.innerHTML = "";

  if (error) {
    lista.innerHTML = `<p>Erro ao listar motoristas: ${textoSeguro(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    lista.innerHTML = "<p>Nenhum motorista cadastrado.</p>";
    return;
  }

  data.forEach((motorista) => {
    const div = document.createElement("div");
    div.className = "motorista-card";

    div.innerHTML = `
      <h3>${textoSeguro(motorista.nome || "Sem nome")}</h3>
      <p><strong>E-mail:</strong> ${textoSeguro(motorista.email || "Sem e-mail")}</p>
      <p>
        <strong>Status:</strong>
        <span class="${motorista.ativo ? "status-ativo" : "status-inativo"}">
          ${motorista.ativo ? "Ativo" : "Inativo"}
        </span>
      </p>

      <div class="divisor"></div>

      <label>Nome</label>
      <input type="text" id="nome_${motorista.id}" value="${textoSeguro(motorista.nome || "")}" />

      <label>E-mail</label>
      <input type="email" id="email_${motorista.id}" value="${textoSeguro(motorista.email || "")}" />

      <button type="button" class="btn-azul" onclick="editarMotorista('${motorista.id}')">
        Salvar alterações
      </button>

      <div class="divisor"></div>

      <label>Nova senha</label>
      <input type="password" id="senha_${motorista.id}" placeholder="Nova senha com mínimo 6 caracteres" />

      <button type="button" class="btn-cinza" onclick="alterarSenhaMotorista('${motorista.id}')">
        Alterar senha
      </button>

      <button type="button" class="${motorista.ativo ? "btn-vermelho" : "btn-verde"}"
        onclick="alterarStatusMotorista('${motorista.id}', ${!motorista.ativo})">
        ${motorista.ativo ? "Inativar motorista" : "Ativar motorista"}
      </button>
    `;

    lista.appendChild(div);
  });
}

async function editarMotorista(id) {
  const nome = document.getElementById(`nome_${id}`).value.trim();
  const email = document.getElementById(`email_${id}`).value.trim();

  if (!nome || !email) {
    alert("Nome e e-mail são obrigatórios.");
    return;
  }

  const resposta = await fetch("/api/gerenciar-motorista", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      acao: "editar",
      id,
      nome,
      email
    })
  });

  const resultado = await resposta.json();

  if (!resposta.ok) {
    alert("Erro ao editar motorista: " + (resultado.error || "erro desconhecido"));
    return;
  }

  alert("Motorista atualizado com sucesso!");

  await carregarMotoristas();
  await listarMotoristas();
}

async function alterarSenhaMotorista(id) {
  const senha = document.getElementById(`senha_${id}`).value.trim();

  if (!senha || senha.length < 6) {
    alert("A nova senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  const resposta = await fetch("/api/gerenciar-motorista", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      acao: "senha",
      id,
      senha
    })
  });

  const resultado = await resposta.json();

  if (!resposta.ok) {
    alert("Erro ao alterar senha: " + (resultado.error || "erro desconhecido"));
    return;
  }

  alert("Senha alterada com sucesso!");

  document.getElementById(`senha_${id}`).value = "";
}

async function alterarStatusMotorista(id, ativo) {
  const confirmar = confirm(
    ativo
      ? "Deseja ativar este motorista?"
      : "Deseja inativar este motorista?"
  );

  if (!confirmar) return;

  const resposta = await fetch("/api/gerenciar-motorista", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      acao: "status",
      id,
      ativo
    })
  });

  const resultado = await resposta.json();

  if (!resposta.ok) {
    alert("Erro ao alterar status: " + (resultado.error || "erro desconhecido"));
    return;
  }

  alert("Status alterado com sucesso!");

  await carregarMotoristas();
  await listarMotoristas();
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

  if (!lista || !select) return;

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
      <h3>${textoSeguro(ponto.nome)}</h3>
      <p><strong>Endereço:</strong> ${textoSeguro(ponto.endereco || "Não informado")}</p>
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
  const motoristaId = document.getElementById("motoristaRota").value;
  const destinoNome = document.getElementById("destinoNome").value.trim();
  const destinoCoordenadas = document.getElementById("destinoCoordenadas").value.trim();

  if (!nome || !data || !horarioInicio || !motoristaId || !destinoNome || !destinoCoordenadas) {
    alert("Preencha todos os dados da rota, incluindo o motorista.");
    return;
  }

  const partes = destinoCoordenadas.split(",");
  const destinoLatitude = Number(partes[0].trim());
  const destinoLongitude = Number(partes[1].trim());

  const dadosRota = {
    nome,
    data,
    horario_inicio: horarioInicio,
    motorista_id: motoristaId,
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
  await carregarGerenciamentoRotas();
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

  await carregarMotoristas();

  if (rota.motorista_id) {
    document.getElementById("motoristaRota").value = rota.motorista_id;
  }

  atualizarTextoRota();
}

function atualizarTextoRota() {
  const texto = document.getElementById("rotaAtualTexto");

  if (!texto) return;

  if (!rotaAtualId) {
    texto.textContent = "Nenhuma rota carregada. Salve a rota antes de adicionar pontos.";
    return;
  }

  texto.textContent = "Rota carregada. Agora adicione pontos cadastrados dentro dela.";
}

function limparFormularioRota() {
  rotaAtualId = null;
  localStorage.removeItem("rotaAtualId");

  document.getElementById("nomeRota").value = "";
  document.getElementById("dataRota").value = "";
  document.getElementById("horarioInicio").value = "";
  document.getElementById("motoristaRota").value = "";
  document.getElementById("destinoNome").value = "";
  document.getElementById("destinoCoordenadas").value = "";

  const lista = document.getElementById("listaPontosRota");

  if (lista) {
    lista.innerHTML = "<p>Nenhum ponto adicionado nesta rota ainda.</p>";
  }

  atualizarTextoRota();
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
  await carregarGerenciamentoRotas();
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

  if (!lista) return;

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
      <h3>${index + 1}. ${textoSeguro(ponto.nome)}</h3>
      <p><strong>Horário:</strong> ${item.horario_previsto || "Não informado"}</p>
      <p><strong>Passageiros:</strong> ${item.qtd_passageiros || 0}</p>
      <p><strong>Endereço:</strong> ${textoSeguro(ponto.endereco || "Não informado")}</p>
      <p><strong>Coordenadas:</strong> ${ponto.latitude}, ${ponto.longitude}</p>
      <p><strong>Status:</strong> ${traduzirStatusPonto(item.status)}</p>
      <p><strong>Observação:</strong> ${textoSeguro(item.observacao || "Sem observação")}</p>

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
  await carregarGerenciamentoRotas();
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
  await carregarGerenciamentoRotas();
}

async function carregarGerenciamentoRotas() {
  const lista = document.getElementById("listaGerenciamentoRotas");

  if (!lista) return;

  const filtro = document.getElementById("filtroStatusRotas");
  const statusFiltro = filtro ? filtro.value : "todas";

  lista.innerHTML = "<p>Carregando rotas...</p>";

  let query = supabaseClient
    .from("rotas")
    .select("*")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (statusFiltro && statusFiltro !== "todas") {
    query = query.eq("status", statusFiltro);
  }

  const { data: rotas, error } = await query;

  if (error) {
    lista.innerHTML = `<p>Erro ao carregar rotas: ${textoSeguro(error.message)}</p>`;
    return;
  }

  if (!rotas || rotas.length === 0) {
    lista.innerHTML = "<p>Nenhuma rota encontrada.</p>";
    return;
  }

  const motoristaIds = [...new Set(rotas.map((rota) => rota.motorista_id).filter(Boolean))];

  let motoristasPorId = {};

  if (motoristaIds.length > 0) {
    const { data: motoristas } = await supabaseClient
      .from("perfis")
      .select("id, nome, email")
      .in("id", motoristaIds);

    if (motoristas) {
      motoristas.forEach((motorista) => {
        motoristasPorId[motorista.id] = motorista;
      });
    }
  }

  const rotaIds = rotas.map((rota) => rota.id);

  let pontosPorRota = {};

  if (rotaIds.length > 0) {
    const { data: pontos } = await supabaseClient
      .from("rota_pontos")
      .select("id, rota_id, qtd_passageiros")
      .in("rota_id", rotaIds);

    if (pontos) {
      pontos.forEach((ponto) => {
        if (!pontosPorRota[ponto.rota_id]) {
          pontosPorRota[ponto.rota_id] = {
            quantidadePontos: 0,
            quantidadePassageiros: 0
          };
        }

        pontosPorRota[ponto.rota_id].quantidadePontos += 1;
        pontosPorRota[ponto.rota_id].quantidadePassageiros += Number(ponto.qtd_passageiros || 0);
      });
    }
  }

  lista.innerHTML = "";

  rotas.forEach((rota) => {
    const motorista = motoristasPorId[rota.motorista_id];
    const resumo = pontosPorRota[rota.id] || {
      quantidadePontos: 0,
      quantidadePassageiros: 0
    };

    const status = rota.status || "ativa";

    const div = document.createElement("div");
    div.className = "rota-card";

    div.innerHTML = `
      <div class="rota-card-topo">
        <div>
          <h3>${textoSeguro(rota.nome || "Rota sem nome")}</h3>
          <p><strong>Data:</strong> ${formatarData(rota.data)}</p>
          <p><strong>Motorista:</strong> ${textoSeguro(motorista?.nome || motorista?.email || "Não informado")}</p>
          <p><strong>Pontos:</strong> ${resumo.quantidadePontos}</p>
          <p><strong>Passageiros:</strong> ${resumo.quantidadePassageiros}</p>
          <p>
            <strong>Status:</strong>
            <span class="${classeStatusRota(status)}">${traduzirStatusRota(status)}</span>
          </p>
        </div>
      </div>

      <div class="acoes">
        <button type="button" class="btn-azul" onclick="editarRotaGerenciamento('${rota.id}')">
          Editar
        </button>

        <button type="button" class="btn-cinza" onclick="duplicarRota('${rota.id}')">
          Duplicar
        </button>

        <button type="button" class="btn-verde" onclick="alterarStatusRota('${rota.id}', 'finalizada')">
          Finalizar
        </button>

        <button type="button" class="btn-cinza" onclick="alterarStatusRota('${rota.id}', 'cancelada')">
          Cancelar
        </button>

        <button type="button" class="btn-vermelho" onclick="excluirRota('${rota.id}')">
          Excluir
        </button>
      </div>
    `;

    lista.appendChild(div);
  });
}

async function editarRotaGerenciamento(id) {
  const { data: rota, error } = await supabaseClient
    .from("rotas")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !rota) {
    alert("Erro ao carregar rota para edição.");
    return;
  }

  rotaAtualId = rota.id;
  localStorage.setItem("rotaAtualId", rotaAtualId);

  document.getElementById("nomeRota").value = rota.nome || "";
  document.getElementById("dataRota").value = rota.data || "";
  document.getElementById("horarioInicio").value = rota.horario_inicio || "";
  document.getElementById("destinoNome").value = rota.destino_nome || "";

  if (rota.destino_latitude && rota.destino_longitude) {
    document.getElementById("destinoCoordenadas").value =
      `${rota.destino_latitude}, ${rota.destino_longitude}`;
  } else {
    document.getElementById("destinoCoordenadas").value = "";
  }

  await carregarMotoristas();

  if (rota.motorista_id) {
    document.getElementById("motoristaRota").value = rota.motorista_id;
  }

  atualizarTextoRota();
  await listarPontosRota();

  toggleModulo("moduloCriarRota");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  alert("Rota carregada para edição.");
}

async function duplicarRota(id) {
  const confirmar = confirm("Deseja duplicar esta rota com todos os pontos?");

  if (!confirmar) return;

  const { data: rotaOriginal, error: erroRota } = await supabaseClient
    .from("rotas")
    .select("*")
    .eq("id", id)
    .single();

  if (erroRota || !rotaOriginal) {
    alert("Erro ao buscar rota original.");
    return;
  }

  const novaRota = {
    nome: `${rotaOriginal.nome || "Rota"} - Cópia`,
    data: rotaOriginal.data,
    horario_inicio: rotaOriginal.horario_inicio,
    motorista_id: rotaOriginal.motorista_id,
    destino_nome: rotaOriginal.destino_nome,
    destino_latitude: rotaOriginal.destino_latitude,
    destino_longitude: rotaOriginal.destino_longitude,
    status: "ativa"
  };

  const { data: rotaCriada, error: erroCriar } = await supabaseClient
    .from("rotas")
    .insert(novaRota)
    .select()
    .single();

  if (erroCriar || !rotaCriada) {
    alert("Erro ao duplicar rota: " + (erroCriar?.message || "erro desconhecido"));
    return;
  }

  const { data: pontosOriginais, error: erroPontos } = await supabaseClient
    .from("rota_pontos")
    .select("*")
    .eq("rota_id", id)
    .order("ordem", { ascending: true });

  if (erroPontos) {
    alert("Rota duplicada, mas houve erro ao buscar os pontos.");
    await carregarGerenciamentoRotas();
    return;
  }

  if (pontosOriginais && pontosOriginais.length > 0) {
    const novosPontos = pontosOriginais.map((ponto) => ({
      rota_id: rotaCriada.id,
      ponto_base_id: ponto.ponto_base_id,
      ordem: ponto.ordem,
      horario_previsto: ponto.horario_previsto,
      qtd_passageiros: ponto.qtd_passageiros,
      observacao: ponto.observacao,
      status: "pendente"
    }));

    const { error: erroInserirPontos } = await supabaseClient
      .from("rota_pontos")
      .insert(novosPontos);

    if (erroInserirPontos) {
      alert("Rota duplicada, mas houve erro ao duplicar os pontos: " + erroInserirPontos.message);
      await carregarGerenciamentoRotas();
      return;
    }
  }

  alert("Rota duplicada com sucesso!");
  await carregarGerenciamentoRotas();
}

async function alterarStatusRota(id, status) {
  let mensagem = "Deseja alterar o status desta rota?";

  if (status === "finalizada") {
    mensagem = "Deseja finalizar esta rota?";
  }

  if (status === "cancelada") {
    mensagem = "Deseja cancelar esta rota?";
  }

  const confirmar = confirm(mensagem);

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("rotas")
    .update({ status })
    .eq("id", id);

  if (error) {
    alert("Erro ao alterar status da rota: " + error.message);
    return;
  }

  if (rotaAtualId === id) {
    await carregarRotaAtual();
    await listarPontosRota();
  }

  await carregarGerenciamentoRotas();

  alert("Status da rota atualizado com sucesso!");
}

async function excluirRota(id) {
  const confirmar = confirm(
    "Deseja excluir esta rota? Esta ação também removerá os pontos vinculados a ela."
  );

  if (!confirmar) return;

  const { error: erroPontos } = await supabaseClient
    .from("rota_pontos")
    .delete()
    .eq("rota_id", id);

  if (erroPontos) {
    alert("Erro ao excluir pontos da rota: " + erroPontos.message);
    return;
  }

  const { error: erroRota } = await supabaseClient
    .from("rotas")
    .delete()
    .eq("id", id);

  if (erroRota) {
    alert("Erro ao excluir rota: " + erroRota.message);
    return;
  }

  if (rotaAtualId === id) {
    limparFormularioRota();
  }

  await carregarGerenciamentoRotas();

  alert("Rota excluída com sucesso!");
}

function traduzirStatusPonto(status) {
  if (status === "coletado") return "Coletado";
  if (status === "ausente") return "Ausente";
  return "Pendente";
}

function traduzirStatusRota(status) {
  if (status === "finalizada") return "Finalizada";
  if (status === "cancelada") return "Cancelada";
  return "Ativa";
}

function classeStatusRota(status) {
  if (status === "finalizada") return "status-finalizada";
  if (status === "cancelada") return "status-cancelada";
  return "status-ativa";
}

function formatarData(data) {
  if (!data) return "Não informada";

  const partes = data.split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
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

  await carregarMotoristas();
  await listarMotoristas();
  await carregarPontosBase();
  await carregarRotaAtual();
  await listarPontosRota();
  await carregarGerenciamentoRotas();

atualizarEstadoVisualPainel(null);
}

iniciarPagina();
