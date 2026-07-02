const SUPABASE_URL = "https://sjkgbnncfigvgebghecb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gD75EJXrTmgeO9wD-Db7LA_UTxXrHLv";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let motoristaEditando = null;
let motoristasCache = [];

async function verificarLogin() {

    const { data } =
        await supabaseClient.auth.getSession();

    if (!data.session) {
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function carregarMotoristas() {

    const lista =
        document.getElementById("listaMotoristas");

    lista.innerHTML =
        '<div class="loading">Carregando...</div>';

    const { data, error } =
        await supabaseClient
            .from("perfis")
            .select("*")
            .eq("perfil", "motorista")
            .eq("arquivado", false)
            .order("nome");

    if (error) {

        lista.innerHTML =
            `<div class="loading">
                Erro: ${error.message}
            </div>`;

        return;
    }

    motoristasCache = data || [];

    renderizarMotoristas(
        motoristasCache
    );
}

function renderizarMotoristas(listaMotoristas) {

    const lista =
        document.getElementById(
            "listaMotoristas"
        );

    lista.innerHTML = "";

    if (!listaMotoristas.length) {

        lista.innerHTML =
            '<div class="loading">Nenhum motorista encontrado.</div>';

        return;
    }

    listaMotoristas.forEach(
        (motorista) => {

            lista.innerHTML += `
                <div class="motorista-card">

                    <h3>
                        ${motorista.nome || "Sem nome"}
                    </h3>

                    <p>
                        ${motorista.email}
                    </p>

                    <p>
                        Status:
                        <span class="${motorista.ativo
                    ? "status-ativo"
                    : "status-inativo"
                }">

                        ${motorista.ativo
                    ? "Ativo"
                    : "Inativo"
                }

                        </span>
                    </p>

                    <div class="acoes-card">

                        <button
                            class="btn-editar"
                            onclick="editarMotorista('${motorista.id}')">

                            Editar

                        </button>
                        <button
                            class="btn-vermelho"
                            onclick="excluirMotorista('${motorista.id}')">

                            Excluir

                        </button>
                        <button
                            class="btn-senha"
                            onclick="alterarSenha('${motorista.id}')">

                            Senha

                        </button>

                        <button
                            class="btn-status ${motorista.ativo
                    ? "inativo"
                    : ""
                }"

                            onclick="alterarStatus(
                                '${motorista.id}',
                                ${!motorista.ativo}
                            )">

                            ${motorista.ativo
                    ? "Inativar"
                    : "Ativar"
                }

                        </button>

                        <button
                            class="btn-arquivar"
                            onclick="arquivarMotorista('${motorista.id}')">

                            Arquivar

                        </button>
                    </div>

                </div>
            `;
        }
    );
}

function filtrarMotoristas() {

    const texto =
        document
            .getElementById(
                "pesquisaMotorista"
            )
            .value
            .toLowerCase();

    const filtrados =
        motoristasCache.filter(
            (m) => {

                return (
                    (m.nome || "")
                        .toLowerCase()
                        .includes(texto)

                    ||

                    (m.email || "")
                        .toLowerCase()
                        .includes(texto)
                );
            }
        );

    renderizarMotoristas(
        filtrados
    );
}

function abrirNovoMotorista() {

    motoristaEditando = null;

    document
        .getElementById(
            "tituloModal"
        )
        .innerText =
        "Novo motorista";

    document
        .getElementById(
            "nomeMotorista"
        )
        .value = "";

    document
        .getElementById(
            "emailMotorista"
        )
        .value = "";

    document
        .getElementById(
            "senhaMotorista"
        )
        .value = "";

    document
        .getElementById(
            "modalMotorista"
        )
        .classList
        .add("ativo");
}

function fecharModal() {

    document
        .getElementById(
            "modalMotorista"
        )
        .classList
        .remove("ativo");
}

function editarMotorista(id) {

    const motorista =
        motoristasCache.find(
            (m) => m.id === id
        );

    if (!motorista) return;

    motoristaEditando = id;

    document
        .getElementById(
            "tituloModal"
        )
        .innerText =
        "Editar motorista";

    document
        .getElementById(
            "nomeMotorista"
        )
        .value =
        motorista.nome || "";

    document
        .getElementById(
            "emailMotorista"
        )
        .value =
        motorista.email || "";

    document
        .getElementById(
            "senhaMotorista"
        )
        .value = "";

    document
        .getElementById(
            "modalMotorista"
        )
        .classList
        .add("ativo");
}

async function salvarMotorista() {

    const nome =
        document
            .getElementById(
                "nomeMotorista"
            )
            .value
            .trim();

    const email =
        document
            .getElementById(
                "emailMotorista"
            )
            .value
            .trim();

    const senha =
        document
            .getElementById(
                "senhaMotorista"
            )
            .value
            .trim();

    if (!nome || !email) {

        alert(
            "Preencha nome e e-mail."
        );

        return;
    }

    if (motoristaEditando) {

        await fetch(
            "/api/gerenciar-motorista",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    acao: "editar",
                    id: motoristaEditando,
                    nome,
                    email
                })
            }
        );

    } else {

        await fetch(
            "/api/criar-motorista",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    nome,
                    email,
                    senha
                })
            }
        );
    }

    fecharModal();

    carregarMotoristas();
}

async function alterarSenha(id) {

    const senha =
        prompt(
            "Nova senha:"
        );

    if (!senha) return;

    await fetch(
        "/api/gerenciar-motorista",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                acao: "senha",
                id,
                senha
            })
        }
    );

    alert(
        "Senha alterada."
    );
}

async function alterarStatus(
    id,
    ativo
) {

    await fetch(
        "/api/gerenciar-motorista",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                acao: "status",
                id,
                ativo
            })
        }
    );

    carregarMotoristas();
}

async function iniciar() {

    const ok =
        await verificarLogin();

    if (!ok) return;

    carregarMotoristas();
}

async function excluirMotorista(id) {
    const confirmar = confirm("Deseja excluir definitivamente este motorista?");

    if (!confirmar) return;

    const resposta = await fetch("/api/gerenciar-motorista", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            acao: "excluir",
            id: id
        })
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
        alert(resultado.error || "Erro ao excluir motorista.");
        return;
    }

    alert("Motorista excluído com sucesso.");
    carregarMotoristas();
}

async function arquivarMotorista(id){

    const confirmar = confirm(
        "Deseja arquivar este motorista?"
    );

    if(!confirmar) return;

    const resposta = await fetch(
        "/api/gerenciar-motorista",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                acao:"arquivar",
                id:id
            })
        }
    );

    const resultado =
        await resposta.json();

    if(!resposta.ok){

        alert(
            resultado.error ||
            "Erro ao arquivar."
        );

        return;
    }

    alert(
        "Motorista arquivado."
    );

    carregarMotoristas();
}

async function excluirMotorista(id){

    const confirmar = confirm(
        "Deseja excluir definitivamente este motorista?"
    );

    if(!confirmar) return;

    const resposta = await fetch(
        "/api/gerenciar-motorista",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                acao:"excluir",
                id:id
            })
        }
    );

    const resultado =
        await resposta.json();

    if(!resposta.ok){

        alert(
            resultado.error ||
            "Erro ao excluir."
        );

        return;
    }

    alert(
        "Motorista excluído."
    );

    carregarMotoristas();
}

iniciar();