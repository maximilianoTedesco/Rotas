const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método não permitido"
        });
    }

    try {

        const {
            acao,
            id,
            nome,
            email,
            senha,
            ativo
        } = req.body;

        const acaoNormalizada =
            String(acao || "")
                .trim()
                .toLowerCase();

        console.log(
            "AÇÃO RECEBIDA:",
            acaoNormalizada
        );

        // =====================================
        // EDITAR
        // =====================================

        if (acaoNormalizada === "editar") {

            const { error } =
                await supabaseAdmin
                    .from("perfis")
                    .update({
                        nome,
                        email
                    })
                    .eq("id", id);

            if (error) {
                return res
                    .status(400)
                    .json({
                        error: error.message
                    });
            }

            return res
                .status(200)
                .json({
                    success: true
                });
        }

        // =====================================
        // SENHA
        // =====================================

        if (acaoNormalizada === "senha") {

            const { error } =
                await supabaseAdmin
                    .auth
                    .admin
                    .updateUserById(
                        id,
                        {
                            password: senha
                        }
                    );

            if (error) {
                return res
                    .status(400)
                    .json({
                        error: error.message
                    });
            }

            return res
                .status(200)
                .json({
                    success: true
                });
        }

        // =====================================
        // STATUS
        // =====================================

        if (acaoNormalizada === "status") {

            const { error } =
                await supabaseAdmin
                    .from("perfis")
                    .update({
                        ativo
                    })
                    .eq("id", id);

            if (error) {
                return res
                    .status(400)
                    .json({
                        error: error.message
                    });
            }

            return res
                .status(200)
                .json({
                    success: true
                });
        }

        // =====================================
        // ARQUIVAR
        // =====================================

        if (acaoNormalizada === "arquivar") {

            const { error } =
                await supabaseAdmin
                    .from("perfis")
                    .update({
                        ativo: false,
                        arquivado: true
                    })
                    .eq("id", id);

            if (error) {
                return res
                    .status(400)
                    .json({
                        error: error.message
                    });
            }

            return res
                .status(200)
                .json({
                    success: true
                });
        }

        // =====================================
        // EXCLUIR
        // =====================================

        if (
            acaoNormalizada === "excluir" ||
            acaoNormalizada === "delete" ||
            acaoNormalizada === "deletar"
        ) {

            const { error: erroPerfil } =
                await supabaseAdmin
                    .from("perfis")
                    .delete()
                    .eq("id", id);

            if (erroPerfil) {
                return res
                    .status(400)
                    .json({
                        error: erroPerfil.message
                    });
            }

            const { error: erroAuth } =
                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(id);

            if (erroAuth) {
                return res
                    .status(400)
                    .json({
                        error: erroAuth.message
                    });
            }

            return res
                .status(200)
                .json({
                    success: true
                });
        }

        // =====================================
        // AÇÃO INVÁLIDA
        // =====================================

        return res
            .status(400)
            .json({
                error:
                    "Ação inválida: " +
                    acaoNormalizada
            });

    }
    catch (error) {

        return res
            .status(500)
            .json({
                error: error.message
            });
    }
};