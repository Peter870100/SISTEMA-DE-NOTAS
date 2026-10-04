import type { Materia } from "./materias";

/** Lista inicial (matriz do ENEM, resumida). O dono carrega uma vez em Banco → Assuntos. */
export const ASSUNTOS_INICIAIS: Record<Materia, string[]> = {
  portugues: ["Interpretação de texto", "Gêneros textuais", "Variação linguística", "Funções da linguagem", "Coesão e coerência", "Figuras de linguagem", "Morfologia", "Sintaxe", "Semântica"],
  literatura: ["Escolas literárias", "Modernismo", "Romantismo", "Realismo e Naturalismo", "Literatura contemporânea", "Gêneros literários", "Intertextualidade"],
  ingles: ["Interpretação de texto", "Vocabulário em contexto", "Gêneros textuais", "Gramática em contexto", "Aspectos culturais"],
  espanhol: ["Interpretação de texto", "Vocabulário em contexto", "Gêneros textuais", "Gramática em contexto", "Aspectos culturais"],
  artes: ["Artes visuais", "Música", "Teatro e dança", "Arte brasileira", "Vanguardas artísticas", "Patrimônio cultural"],
  educacao_fisica: ["Práticas corporais", "Esporte e sociedade", "Saúde e qualidade de vida", "Corpo e cultura", "Lazer"],
  historia: ["Antiguidade", "Idade Média", "Idade Moderna", "Brasil Colônia", "Brasil Império", "Brasil República", "Era Vargas", "Ditadura militar", "Guerras mundiais", "Guerra Fria", "Revoluções", "Cidadania e direitos"],
  geografia: ["Cartografia", "Clima", "Relevo e solos", "Hidrografia", "Biomas e vegetação", "População", "Urbanização", "Agropecuária", "Indústria e energia", "Globalização", "Questões ambientais", "Geopolítica"],
  filosofia: ["Filosofia antiga", "Ética", "Política", "Teoria do conhecimento", "Filosofia moderna", "Filosofia contemporânea"],
  sociologia: ["Cultura e sociedade", "Trabalho", "Desigualdade social", "Movimentos sociais", "Estado e poder", "Cidadania", "Meios de comunicação"],
  fisica: ["Cinemática", "Dinâmica", "Energia e trabalho", "Hidrostática", "Termologia", "Termodinâmica", "Óptica", "Ondulatória", "Eletrostática", "Eletrodinâmica", "Magnetismo", "Física moderna"],
  quimica: ["Atomística", "Tabela periódica", "Ligações químicas", "Funções inorgânicas", "Estequiometria", "Soluções", "Termoquímica", "Cinética química", "Equilíbrio químico", "Eletroquímica", "Química orgânica", "Química ambiental"],
  biologia: ["Citologia", "Genética", "Evolução", "Ecologia", "Fisiologia humana", "Botânica", "Zoologia", "Microbiologia", "Bioquímica", "Biotecnologia", "Saúde e doenças"],
  matematica: ["Razão e proporção", "Porcentagem", "Funções", "Equações e inequações", "Progressões", "Geometria plana", "Geometria espacial", "Geometria analítica", "Trigonometria", "Estatística", "Probabilidade", "Análise combinatória", "Matemática financeira", "Leitura de gráficos e tabelas"],
};
