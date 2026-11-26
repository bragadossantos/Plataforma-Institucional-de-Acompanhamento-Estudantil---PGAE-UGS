# Proposta Visual — Design System da PGAE

**Estado:** proposta para avaliação. Nada aqui está implementado; será aplicado na Fase 1 após aprovação.

## 1. Princípios

A PGAE é uma **ferramenta de trabalho institucional**, não um site de divulgação. O desenho segue quatro ideias:

1. **Dados primeiro.** Tabelas, KPIs e estados são o conteúdo; a decoração é mínima.
2. **Dois mundos, duas densidades.** O estudante vota no telemóvel (ecrãs grandes, táteis, um objetivo por ecrã). O GAE e os Delegados trabalham em painéis densos e filtráveis.
3. **Confiança visível.** O anonimato do voto e a barreira k ≥ 5 aparecem como elementos de interface claros, não como letras miúdas.
4. **Tom:** sóbrio, direto, institucional, jovem.

Do guia de marca de referência foram aproveitados apenas **paleta, tipografia, tom, contornos e filosofia de cor** (Azul para autoridade, Creme para leitura confortável, Laranja como ponto focal de ação). Logótipos, texturas, fotografia e grafismos do evento de origem **não** são usados.

## 2. Cor

### Tokens base

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--bg` | `#F4F2EC` | Fundo da aplicação (Creme) |
| `--surface` | `#FBFAF6` | Cartões, tabelas, formulários |
| `--border` | `#DCD8CC` | Contornos subtis |
| `--ink` | `#10162B` | Texto principal (Azul-Noite) |
| `--ink-2` | `#1A2240` | Barra lateral, cabeçalhos escuros |
| `--ink-muted` | `#5B6178` | Texto secundário, legendas |
| `--brand` | `#004AAD` | Azul institucional: item ativo, ligações, série principal dos gráficos, foco |
| `--accent` | `#C2410C` | Laranja: ação principal em fundo claro |
| `--accent-on-dark` | `#FF6B35` | Laranja em fundo escuro |

### Semânticas (só para estado e alerta)

| Significado | Texto | Fundo |
| :--- | :--- | :--- |
| Destaque / Resolvido | `#15803D` | `#DCFCE7` |
| Atenção / Em análise | `#B45309` | `#FEF3C7` |
| Crítico | `#B91C1C` | `#FEE2E2` |

**Regras:** laranja só em ações principais e métricas-chave (um CTA primário por ecrã); cores semânticas nunca como decoração; estado nunca comunicado só por cor (sempre com texto e/ou ícone). Contraste mínimo WCAG AA.

> Nota: o azul `#004AAD` vem do guia de referência e a especificação não o menciona. Proponho-o como cor institucional "viva" ao lado do Azul-Noite. Se preferir seguir estritamente a especificação, remove-se e o Azul-Noite assume o papel.

## 3. Tipografia

| Papel | Fonte | Pesos |
| :--- | :--- | :--- |
| Títulos e KPIs | Space Grotesk | 500, 700 |
| Texto, formulários, tabelas | IBM Plex Sans | 400, 600 |
| Códigos de turma, tags, datas | IBM Plex Mono | 500 |

Todas com licença aberta (OFL), carregadas com `next/font` (sem pedidos a terceiros em produção).

Escala: KPI 36/40 · H1 28/34 · H2 20/28 · corpo 16/24 · tabela 14/20 · legenda 12/16. No telemóvel nunca abaixo de 16 px em campos de formulário (evita zoom no iOS).

## 4. Forma, espaço e movimento

- Grelha de 4 px; espaçamentos 4/8/12/16/24/32.
- Raio: 12 px em cartões, 10 px em campos e botões, *pill* só em etiquetas de estado e código.
- Cartões com contorno `--border` e sombra quase nula; sem gradientes.
- Alvos tácteis ≥ 44 × 44 px.
- Movimento curto (120–200 ms), só para feedback (selecionado, enviado). Respeita `prefers-reduced-motion`.

## 5. Estrutura dos ecrãs

### Estudante (`/votar`, telemóvel, sem navegação)

```
┌────────────────────────┐
│ PGAE · UGS             │
│ ┌────────────────────┐ │
│ │ ✔ Voto 100% anónimo│ │  selo verde, sempre visível
│ │ O teu número só    │ │
│ │ valida a turma.    │ │
│ └────────────────────┘ │
│ Código da turma        │
│ [ EI3A-7K9P          ] │  mono
│ N.º de estudante       │
│ [                    ] │
│ [      Continuar     ] │  laranja, largura total
└────────────────────────┘
```

Ecrã 2: um cartão por docente, critérios com cinco botões `1–5` grandes. Ecrã 3: campo opcional de inquietação e botão único **Submeter Avaliação Anónima**. Barra de progresso fina no topo.

### GAE / Delegado / Observador (desktop primeiro, responsivo)

```
┌──────────┬──────────────────────────────────────────────┐
│ PGAE     │ Dashboard · Ciclo 2026-S2 ▾  Faculdade ▾ …   │
│          │                      [Exportar para a Direção]│
│ ▸ Painel │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐      │
│   Estrut.│ │Adesão │ │Média  │ │Destaq.│ │Alertas│      │
│   Utiliz.│ │ 68 %  │ │ 3.9   │ │  12   │ │   3   │      │
│   Ciclos │ └───────┘ └───────┘ └───────┘ └───────┘      │
│   Audit. │ Docentes em destaque        Alertas críticos │
│   Relat. │ ┌──────────────────────┐   ┌───────────────┐ │
│          │ │ tabela               │   │ fila          │ │
│ Utilizad.│ └──────────────────────┘   └───────────────┘ │
└──────────┴──────────────────────────────────────────────┘
```

- Barra lateral em Azul-Noite com itens por perfil (o menu só mostra o que o perfil pode usar); no telemóvel passa a gaveta.
- Topo fixo com 4 KPIs e filtros instantâneos; botão de exportação no canto superior direito (laranja, único CTA).
- O Observador vê só `/insights`, com um aviso permanente de "dados anonimizados e aprovados pelo GAE".

## 6. Componentes principais

| Componente | Notas |
| :--- | :--- |
| **KPI card** | Rótulo pequeno, valor em Space Grotesk 700, variação opcional; sem gráficos decorativos |
| **Tabela de dados** | Cabeçalho fixo, linhas de 44 px, números alinhados à direita, ordenável, estado vazio explicativo |
| **Badge de estado** | *Pill* com cor semântica + texto (`Novo`, `Em análise`, `Encaminhado`, `Resolvido`) |
| **Selo de anonimato** | Verde, ícone de escudo, texto fixo da especificação |
| **Estado k < 5** | Cartão tracejado cinzento: "Amostra insuficiente para preservação do anonimato (< 5 votos)" |
| **Seletor de nota 1–5** | Cinco botões 44 px, estado selecionado em `--brand`, navegável por teclado |
| **Chip de código** | IBM Plex Mono 500, botão "copiar", ação "rodar código" só para GAE |
| **Cartão de gravidade** | Baixa/Média/Alta/Crítica com cor e texto, seleção única |
| **Medidor TPT** | Barra horizontal com percentagem e votos/total estimado |
| **Formulário** | Rótulo sempre visível, erro em texto junto ao campo, honeypot invisível |

Gráficos: série principal `--brand`, secundária `--ink-muted`; semânticas só para limiares (IDD ≥ 4.20, < 3.00). Sempre com rótulos diretos ou legenda e tabela alternativa.

## 7. Identidade e logótipo

- **Provisório:** marca de texto "PGAE" em Space Grotesk 700 + "UGS · GAE" em IBM Plex Sans, sem símbolo.
- **Oficial:** o logótipo da UGS e do GAE deve ser **fornecido ou aprovado pela instituição**. Não descarreguei nenhum da internet: marcas institucionais têm direitos de uso e o próprio guia de referência exige aprovação prévia da direção para peças com o nome e o logótipo da UGS/FENT. Assim que tiver o ficheiro (SVG/PNG com fundo transparente), entra em `public/brand/`.
- Área de proteção: altura do "P" em redor do logótipo; mínimo 24 px de altura no ecrã.

## 8. Acessibilidade e desempenho

- WCAG 2.2 AA: contraste, foco visível (anel `--brand` 2 px), navegação por teclado, rótulos em todos os campos.
- Mobile-first testado a 360 px e 390 px; fluxo de voto < 90 s.
- Apenas 3 famílias de fontes, subconjunto latino, `font-display: swap`.
- Tema escuro fora do MVP (YAGNI); os tokens ficam preparados para o permitir depois.

## 9. Decisões para si

1. Aprova o **azul `#004AAD`** como cor institucional adicional?
2. Logótipo UGS/GAE: pode fornecer o ficheiro oficial?
3. Nome visível na interface: "PGAE" ou "Plataforma GAE"?
4. Mantemos a navegação lateral para GAE/Delegado (recomendado) ou barra superior?
