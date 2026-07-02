
const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { acao, id, nome, email, senha, ativo } = req.body;

    if (!acao || !id) {
      return res.status(400).json({ error: "Ação e ID são obrigatórios" });
    }

    if (acao === "editar") {
      const { error: erroPerfil } = await supabaseAdmin
        .from("perfis")
        .update({ nome, email })
        .eq("id", id);

      if (erroPerfil) {
        return res.status(400).json({ error: erroPerfil.message });
      }

      if (email) {
        const { error: erroAuth } =
          await supabaseAdmin.auth.admin.updateUserById(id, { email });

        if (erroAuth) {
          return res.status(400).json({ error: erroAuth.message });
        }
      }

      return res.status(200).json({ success: true });
    }

    if (acao === "senha") {
      if (!senha || senha.length < 6) {
        return res.status(400).json({
          error: "A senha precisa ter pelo menos 6 caracteres"
        });
      }

      const { error } =
        await supabaseAdmin.auth.admin.updateUserById(id, {
          password: senha
        });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    if (acao === "status") {
      const { error: erroPerfil } = await supabaseAdmin
        .from("perfis")
        .update({ ativo })
        .eq("id", id);

if (acao === "arquivar") {

    const { error } = await supabaseAdmin
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

      if (acao === "excluir") {

    const { error } = await supabaseAdmin
        .from("perfis")
        .delete()
        .eq("id", id);

      if (error) {
          return res
              .status(400)
              .json({
                  error:error.message
              });
                  }

                  return res
                      .status(200)
                      .json({
                          sucesso:true
                      });
              }

      if (erroPerfil) {
        return res.status(400).json({ error: erroPerfil.message });
      }

      const { error: erroAuth } =
        await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: ativo ? "none" : "876000h"
        });

      if (erroAuth) {
        return res.status(400).json({ error: erroAuth.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Ação inválida" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
