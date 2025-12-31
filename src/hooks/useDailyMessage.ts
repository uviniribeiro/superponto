import { useMemo } from 'react';

const messages = [
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Acredite que você pode, assim você já está no meio do caminho.", author: "Theodore Roosevelt" },
  { text: "A única maneira de fazer um ótimo trabalho é amar o que você faz.", author: "Steve Jobs" },
  { text: "Não espere por oportunidades extraordinárias. Agarre ocasiões comuns e as faça grandes.", author: "Orison Swett Marden" },
  { text: "O futuro pertence àqueles que acreditam na beleza de seus sonhos.", author: "Eleanor Roosevelt" },
  { text: "Porque eu, o Senhor teu Deus, te tomo pela tua mão direita; e te digo: Não temas, eu te ajudo.", author: "Isaías 41:13" },
  { text: "Tudo posso naquele que me fortalece.", author: "Filipenses 4:13" },
  { text: "O Senhor é a minha força e o meu escudo; nele o meu coração confia.", author: "Salmos 28:7" },
  { text: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", author: "Salmos 37:5" },
  { text: "Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus.", author: "Isaías 41:10" },
  { text: "Cada dia é uma nova chance para fazer diferente.", author: "Autor desconhecido" },
  { text: "Sua atitude determina sua direção.", author: "Autor desconhecido" },
  { text: "Pequenos passos ainda são passos.", author: "Autor desconhecido" },
  { text: "Você é mais forte do que imagina.", author: "Autor desconhecido" },
  { text: "A alegria do Senhor é a nossa força.", author: "Neemias 8:10" },
  { text: "Porque para Deus nada é impossível.", author: "Lucas 1:37" },
  { text: "Confie no Senhor de todo o seu coração.", author: "Provérbios 3:5" },
  { text: "O Senhor é meu pastor, nada me faltará.", author: "Salmos 23:1" },
  { text: "Grandes realizações são possíveis quando você dá importância aos pequenos começos.", author: "Autor desconhecido" },
  { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { text: "Que a paz de Deus que excede todo o entendimento guarde o seu coração.", author: "Filipenses 4:7" },
  { text: "Eis que estou convosco todos os dias.", author: "Mateus 28:20" },
  { text: "Busquem primeiro o Reino de Deus e a sua justiça, e todas estas coisas vos serão acrescentadas.", author: "Mateus 6:33" },
  { text: "O amor é paciente, o amor é bondoso.", author: "1 Coríntios 13:4" },
  { text: "Andai enquanto tendes luz, para que as trevas não vos apanhem.", author: "João 12:35" },
  { text: "Não se preocupe com o amanhã, pois o amanhã trará suas próprias preocupações.", author: "Mateus 6:34" },
  { text: "A fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.", author: "Hebreus 11:1" },
  { text: "Seja forte e corajoso. Não tenha medo; não desanime, pois o Senhor estará com você.", author: "Josué 1:9" },
  { text: "Cada manhã traz novas forças e novos pensamentos.", author: "Eleanor Roosevelt" },
  { text: "A mudança começa com você.", author: "Autor desconhecido" },
  { text: "Clama a mim, e responder-te-ei.", author: "Jeremias 33:3" },
];

export function useDailyMessage() {
  const dailyMessage = useMemo(() => {
    // Get day of year to have a consistent message for each day
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    // Use day of year to select a message
    const index = dayOfYear % messages.length;
    return messages[index];
  }, []);

  return dailyMessage;
}
