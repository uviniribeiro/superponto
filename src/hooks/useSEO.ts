import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
}

const defaultSEO: SEOProps = {
  title: 'Ponto Max - Sistema de Ponto Eletrônico',
  description: 'Sistema completo de gestão de ponto eletrônico para prefeituras e empresas. Controle de jornada, espelho de ponto, banco de horas e muito mais.',
  keywords: 'ponto eletrônico, gestão de funcionários, controle de ponto, prefeitura, empresa, REP, Portaria 671, banco de horas, espelho de ponto',
  ogImage: 'https://storage.googleapis.com/gpt-engineer-file-uploads/2mLjcyuYfya3CwaY6yN4bUirDmO2/uploads/1767114614759-imagem_2025-12-30_141014740.png',
  ogType: 'website'
};

const pageSEO: Record<string, SEOProps> = {
  '/home': {
    title: 'Home | Ponto Max - Sistema de Ponto Eletrônico',
    description: 'Painel inicial do Ponto Max. Acesse rapidamente todas as funcionalidades de gestão de ponto eletrônico.'
  },
  '/dashboard': {
    title: 'Dashboard | Ponto Max - Sistema de Ponto Eletrônico',
    description: 'Visualize estatísticas e relatórios do seu sistema de ponto eletrônico. Análise de horas trabalhadas, extras e banco de horas.'
  },
  '/time-clock': {
    title: 'Registrar Ponto | Ponto Max',
    description: 'Registre seu ponto eletrônico de forma rápida e segura. Entrada, saída e intervalos com geolocalização.'
  },
  '/employees': {
    title: 'Funcionários | Ponto Max - Gestão de Colaboradores',
    description: 'Gerencie todos os funcionários da sua empresa. Cadastro, escalas, jornadas e histórico de ponto.'
  },
  '/schedules': {
    title: 'Escalas de Trabalho | Ponto Max',
    description: 'Configure escalas de trabalho: 5x1, 6x1, 12x36, horários flexíveis e personalizados.'
  },
  '/mirror-point': {
    title: 'Espelho de Ponto | Ponto Max - Portaria 671',
    description: 'Gere espelhos de ponto conforme Portaria 671 do MTE. Relatórios detalhados de jornada de trabalho.'
  },
  '/teacher-module': {
    title: 'Módulo Professor | Ponto Max - Gestão Escolar',
    description: 'Módulo especializado para gestão de professores. Hora aula, hora atividade, quadro de horários e espelho de ponto docente.',
    keywords: 'módulo professor, hora aula, gestão escolar, quadro de horários, ponto docente, EducaNet'
  },
  '/reports': {
    title: 'Relatórios | Ponto Max',
    description: 'Relatórios completos de ponto eletrônico. Exportação AFD, relatórios de horas extras e banco de horas.'
  },
  '/equipment': {
    title: 'Equipamentos REP | Ponto Max',
    description: 'Gerencie relógios de ponto REP. Sincronização, monitoramento e conformidade com Portaria 671.'
  },
  '/time-bank': {
    title: 'Banco de Horas | Ponto Max',
    description: 'Controle completo de banco de horas. Débitos, créditos e compensações automáticas.'
  },
  '/adjustments': {
    title: 'Ajustes de Ponto | Ponto Max',
    description: 'Solicite e aprove ajustes de ponto eletrônico. Workflow de aprovação e histórico de alterações.'
  },
  '/holidays': {
    title: 'Feriados | Ponto Max',
    description: 'Configure feriados nacionais, estaduais e municipais para cálculo correto de horas extras.'
  },
  '/auth': {
    title: 'Login | Ponto Max - Sistema de Ponto Eletrônico',
    description: 'Acesse o sistema Ponto Max. Sistema seguro de ponto eletrônico para sua empresa ou prefeitura.',
    noIndex: true
  },
  '/super-admin': {
    title: 'Super Admin | Ponto Max',
    description: 'Painel de administração geral do Ponto Max.',
    noIndex: true
  }
};

export function useSEO(customSEO?: SEOProps) {
  const location = useLocation();

  useEffect(() => {
    const pagePath = location.pathname;
    const currentPageSEO = pageSEO[pagePath] || {};
    const seo = { ...defaultSEO, ...currentPageSEO, ...customSEO };

    // Update title
    document.title = seo.title || defaultSEO.title!;

    // Update meta tags
    updateMetaTag('description', seo.description);
    updateMetaTag('keywords', seo.keywords);
    updateMetaTag('robots', seo.noIndex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    updateMetaTag('og:title', seo.title, 'property');
    updateMetaTag('og:description', seo.description, 'property');
    updateMetaTag('og:image', seo.ogImage, 'property');
    updateMetaTag('og:type', seo.ogType, 'property');
    updateMetaTag('og:url', window.location.href, 'property');

    // Twitter
    updateMetaTag('twitter:title', seo.title);
    updateMetaTag('twitter:description', seo.description);
    updateMetaTag('twitter:image', seo.ogImage);

    // Canonical
    updateCanonical(seo.canonical || window.location.origin + location.pathname);

    // Structured data for organization
    updateStructuredData();

  }, [location.pathname, customSEO]);
}

function updateMetaTag(name: string, content?: string, attribute: 'name' | 'property' = 'name') {
  if (!content) return;

  let meta = document.querySelector(`meta[${attribute}="${name}"]`);
  
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  
  meta.setAttribute('content', content);
}

function updateCanonical(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  
  link.setAttribute('href', href);
}

function updateStructuredData() {
  const existingScript = document.getElementById('structured-data-org');
  if (existingScript) return;

  const script = document.createElement('script');
  script.id = 'structured-data-org';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'Ponto Max',
    'applicationCategory': 'BusinessApplication',
    'operatingSystem': 'Web',
    'description': 'Sistema completo de gestão de ponto eletrônico para prefeituras e empresas.',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'BRL'
    },
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': '4.8',
      'ratingCount': '150'
    }
  });
  
  document.head.appendChild(script);
}

export default useSEO;
