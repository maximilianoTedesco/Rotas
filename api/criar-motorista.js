
const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: "Variáveis de ambiente não configuradas na Vercel"
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        error: "Nome, e-mail e senha são obrigatórios"
      });
    }

    const { data: usuarioCriado, error: erroAuth } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome
        }
      });

    if (erroAuth) {
      return res.status(400).json({
        error: erroAuth.message
      });
    }

    const userId = usuarioCriado.user.id;

    const { error: erroPerfil } = await supabaseAdmin
      .from("perfis")
      .insert({
        id: userId,
        nome,
        email,
        perfil: "motorista",
        ativo: true
      });

    if (erroPerfil) {
      return res.status(400).json({
        error: erroPerfil.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Motorista criado com sucesso"
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};
