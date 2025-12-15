import { GoogleGenAI } from "@google/genai";
import { AppState } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateFinancialAnalysis = async (data: AppState): Promise<string> => {
  const ai = getClient();
  if (!ai) return "Erro: Chave de API não configurada. Verifique process.env.API_KEY.";

  const prompt = `
    Você é um CFO (Diretor Financeiro) experiente, especializado em eficiência operacional para pequenas equipes.
    
    Analise os seguintes dados financeiros da empresa (em Português):
    ${JSON.stringify({
      revenue_summary: data.transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0),
      expense_summary: data.transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0),
      open_services: data.services.filter(s => s.status === 'ONGOING').length,
      pending_payments: data.transactions.filter(t => t.status === 'PENDING').length,
      top_expenses: data.transactions.filter(t => t.type === 'EXPENSE').sort((a,b) => b.amount - a.amount).slice(0, 5).map(t => `${t.description}: ${t.amount}`)
    }, null, 2)}

    Gere um relatório executivo curto, direto e profissional.

    REGRAS DE FORMATAÇÃO (MANDATÓRIO E RIGOROSO):
    1. É ESTRITAMENTE PROIBIDO usar placeholders como "# Texto", "# Report", "**texto**", "#Text", "Insira título aqui" ou qualquer variação genérica.
    2. NÃO use asteriscos isolados (*) ou hashtags (#) soltas que não sejam para cabeçalhos Markdown reais.
    3. Use APENAS títulos reais e semânticos (Ex: "## Resumo Financeiro", "## Alertas", "## Sugestão").
    4. O texto deve ser limpo, formatado corretamente em Markdown e pronto para leitura final.
    5. Se não houver dados suficientes para uma seção, não crie a seção com texto genérico; omita-a.

    ESTRUTURA ESPERADA DO CONTEÚDO:
    ## Saúde Financeira
    (Análise breve do lucro vs prejuízo e margem atual)

    ## Pontos de Atenção
    (Liste gastos elevados ou pendências críticas, se houver)

    ## Ação Recomendada
    (Uma única estratégia prática para a próxima semana)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com a IA. Tente novamente mais tarde.";
  }
};