# Prospector Pro

PROSPECTOR 7TEKNOLOGIA — MVP GRATUITO

Crie uma aplicação web interna chamada Prospector 7TEKNOLOGIA.

O sistema será utilizado para pesquisar, importar, qualificar e organizar leads de empresas locais, principalmente da Zona Norte de São Paulo, com o objetivo de prospectar empresas que possam contratar criação de sites.

OBJETIVO PRINCIPAL

Criar uma ferramenta simples, profissional e escalável que permita:

importar leads através de CSV;

colar listas de leads diretamente no sistema;

organizar leads por nicho e região;

eliminar duplicados;

identificar leads sem site;

calcular automaticamente uma pontuação comercial;

classificar leads por prioridade;

gerar mensagens personalizadas por nicho;

criar links individuais para WhatsApp;

armazenar Instagram e LinkedIn quando disponíveis;

controlar contatos e follow-ups;

exportar os leads para XLSX e CSV.

IMPORTANTE

Nesta primeira versão NÃO utilizar APIs pagas.

NÃO inventar APIs, endpoints ou credenciais.

NÃO fazer scraping automático do Google Maps, Instagram ou LinkedIn nesta primeira versão.

A arquitetura deve ficar preparada para receber uma fonte automática de leads futuramente.

TECNOLOGIA

Utilize:

React

TypeScript

Vite

Tailwind CSS

Supabase

componentes modernos e responsivos

Utilize Supabase para persistência dos dados.

Ative Row Level Security (RLS).

Não criar políticas públicas que permitam acesso indiscriminado aos leads.

IDENTIDADE

Nome:

Prospector 7TEKNOLOGIA

Subtítulo:

Pesquisa, qualificação e prospecção inteligente de leads locais

Interface profissional de SaaS B2B.

Criar sidebar de navegação.

Menu:

Dashboard

Leads

Importar Leads

Nichos

Mensagens

Follow-ups

Configurações

DASHBOARD

Criar dashboard com os seguintes indicadores:

Total de leads

Leads novos

Leads qualificados

Leads sem site

Leads com WhatsApp

Leads com Instagram

Leads com LinkedIn

Leads A+

Leads A

Leads B

Leads contatados

Respostas

Interessados

Propostas

Clientes

Adicionar gráficos simples mostrando:

leads por nicho;

leads por bairro;

leads por prioridade;

evolução dos contatos;

conversão da prospecção.

CADASTRO DO LEAD

Cada lead deve possuir:

ID

Empresa

Segmento

Subsegmento

Região

Bairro

Endereço

Cidade

Estado

CEP

Telefone

WhatsApp

Google Maps

Avaliações Google

Nota Google

Site

Status do site

Instagram

LinkedIn

Facebook

Prioridade

Score

Motivo da oportunidade

Mensagem

Status comercial

Data de coleta

Data do contato

Data do follow-up

Resultado

Observações

STATUS DO SITE

Criar os seguintes valores:

Não verificado

Sem site confirmado

Site encontrado

Site inválido

IMPORTANTE:

Não assumir automaticamente que uma empresa não possui site apenas porque o campo está vazio.

O usuário deve poder alterar esse status manualmente.

STATUS COMERCIAL

Criar:

Novo

Qualificado

Contatado

Respondeu

Interessado

Proposta enviada

Negociação

Cliente

Sem interesse

Sem resposta

Follow-up

Descartado

PRIORIDADE

Criar:

A+

Lead altamente qualificado.

A

Lead com bom potencial.

B

Lead com potencial moderado.

C

Lead de baixa prioridade.

SCORE

Criar score de 0 a 100.

O cálculo inicial deverá considerar:

Sem site confirmado

+30

Telefone disponível

+15

WhatsApp disponível

+10

50 ou mais avaliações

+15

20 a 49 avaliações

+10

Nota Google igual ou superior a 4,5

+10

Instagram encontrado

+5

LinkedIn encontrado

+5

Empresa local independente

+10

Limitar o resultado máximo a 100.

Permitir futuramente alterar esses pesos através das configurações.

NICHOS

Criar cadastro de nichos.

Adicionar inicialmente:

Estética / Beleza

Oficinas / Automotivo

Pet / Banho e Tosa

Barbearias

Clínicas

Marcenarias / Móveis Planejados

Assistência Técnica

Odontologia

Imobiliárias / Corretores

Restaurantes / Pizzarias

Permitir criar novos nichos.

Cada nicho deverá poder possuir:

nome;

descrição;

mensagem padrão;

ativo/inativo.

MENSAGENS POR NICHO

Criar um sistema de templates.

Utilizar variáveis:

{{empresa}}

{{segmento}}

{{bairro}}

{{cidade}}

Exemplo para estética:

"Olá! Tudo bem? Falo com a responsável pela {{empresa}}?

Estamos selecionando alguns negócios de estética da região para uma proposta de presença digital mais sofisticada.

A {{empresa}} ainda não possui um site próprio, e acreditamos que uma apresentação digital elegante e sob medida pode valorizar os serviços, elevar a percepção da marca e facilitar novos contatos.

Posso te apresentar a proposta?"

Criar mensagens semelhantes para os demais nichos.

As mensagens devem ser editáveis pelo usuário.

WHATSAPP

Criar botão:

ABRIR WHATSAPP

O botão deve gerar uma URL no formato:

https://wa.me/55NUMERO?text=MENSAGEM_CODIFICADA

A mensagem deve ser automaticamente personalizada com os dados do lead.

Exemplo:

{{empresa}} → nome da empresa.

O sistema NÃO deve enviar a mensagem automaticamente.

Ao clicar:

abrir WhatsApp Web ou aplicativo disponível;

preencher o número;

preencher a mensagem;

deixar o envio sob responsabilidade do usuário.

Adicionar botão:

COPIAR MENSAGEM

INSTAGRAM

Criar campo para URL do Instagram.

Criar botão:

ABRIR INSTAGRAM

Abrir em nova aba.

Não implementar automação de mensagens.

LINKEDIN

Criar campo para URL do LinkedIn.

Criar botão:

ABRIR LINKEDIN

Abrir em nova aba.

Não implementar automação de mensagens.

IMPORTAÇÃO DE LEADS

Criar página:

Importar Leads

Permitir:

CSV

Upload de arquivo CSV.

Colar dados

Criar uma caixa onde o usuário possa colar dados tabulares diretamente.

Aceitar colunas como:

Empresa
Segmento
Região
Bairro
Telefone
Avaliações
Nota
Site
Instagram
LinkedIn

Criar pré-visualização antes da importação.

Mostrar:

quantidade de linhas;

campos detectados;

possíveis erros;

duplicados encontrados.

Botões:

Validar

Importar

DUPLICADOS

Detectar duplicados utilizando principalmente:

telefone;

domínio do site;

combinação empresa + bairro.

Antes da importação mostrar:

novos;

duplicados;

inválidos.

Permitir escolher:

Ignorar duplicados

ou

Atualizar registro existente

TABELA DE LEADS

Criar tabela profissional.

Colunas:

checkbox;

Empresa;

Nicho;

Bairro;

Avaliações;

Nota;

Site;

Instagram;

LinkedIn;

WhatsApp;

Score;

Prioridade;

Status.

Adicionar filtros:

Nicho

Bairro

Região

Prioridade

Score

Status

Status do site

Com WhatsApp

Com Instagram

Com LinkedIn

Quantidade de avaliações

Adicionar busca por nome.

Adicionar ordenação.

Adicionar paginação.

AÇÕES EM MASSA

Permitir selecionar vários leads.

Ações:

alterar nicho;

alterar prioridade;

alterar status;

marcar como qualificado;

exportar selecionados.

NÃO criar envio automático de mensagens.

EXPORTAÇÃO

Implementar:

Exportar XLSX

Exportar CSV

A exportação deve respeitar os filtros aplicados.

Campos:

ID
Empresa
Segmento
Subsegmento
Região
Bairro
Endereço
Telefone
WhatsApp
Avaliações
Nota
Site
Status do site
Instagram
LinkedIn
Facebook
Score
Prioridade
Motivo da oportunidade
Mensagem
Status comercial
Data da coleta
Data do contato
Data do follow-up
Resultado
Observações

MOTIVO DA OPORTUNIDADE

Criar campo automático baseado nos dados.

Exemplos:

"Empresa com 87 avaliações Google e sem site confirmado."

"Empresa com boa reputação local, mas sem site próprio."

"Empresa possui Instagram ativo, mas não possui site."

"Empresa possui forte presença no Google e oportunidade de fortalecer presença digital própria."

Esse campo deve poder ser editado manualmente.

FOLLOW-UP

Criar página de acompanhamento.

Permitir registrar:

data do primeiro contato;

canal;

resposta;

data do follow-up;

resultado;

observações.

Criar filtros:

follow-up hoje;

follow-up atrasado;

sem resposta;

interessados;

propostas enviadas.

BANCO DE DADOS SUPABASE

Criar tabelas adequadas para:

leads

niches

message_templates

lead_interactions

search_jobs

settings

users

Utilizar UUID.

Criar timestamps:

created_at

updated_at

Criar índices para:

telefone;

empresa;

bairro;

nicho;

status;

prioridade;

score.

Criar relacionamentos adequados.

Ativar RLS.

ARQUITETURA PARA FUTURA AUTOMAÇÃO

Mesmo sem API nesta primeira versão, criar uma camada de abstração:

LeadProvider

Preparar métodos:

searchBusinesses()

getBusinessDetails()

validateWebsite()

findSocialProfiles()

validateLead()

Por enquanto utilizar somente:

ManualImportProvider

O provider manual deverá aceitar os dados importados pelo usuário.

No futuro poderemos adicionar outros providers sem precisar reconstruir o sistema.

SEGURANÇA

Não armazenar senhas de redes sociais.

Não solicitar login do Google, Instagram ou LinkedIn.

Não criar automação de login.

Não criar bypass de CAPTCHA.

Não criar scraping agressivo.

Não criar disparo automático de WhatsApp.

Não criar disparo automático de Instagram.

Não criar disparo automático de LinkedIn.

O sistema é uma ferramenta de pesquisa, qualificação, organização e preparação da prospecção.

EXPERIÊNCIA DO USUÁRIO

A aplicação deve ser rápida e simples.

O fluxo principal deve ser:

Dashboard
→ Importar Leads
→ Validar
→ Qualificar
→ Revisar
→ Abrir WhatsApp
→ Registrar contato
→ Follow-up
→ Exportar

Criar feedback visual para todas as ações.

Utilizar confirmações antes de excluir registros.

Criar estados de loading, vazio e erro.

DADOS DE DEMONSTRAÇÃO

Criar poucos leads fictícios apenas para demonstrar a interface.

Identificar claramente os dados como:

DEMONSTRAÇÃO

Não utilizar dados fictícios como se fossem empresas reais.

IMPORTANTE — ORDEM DE IMPLEMENTAÇÃO

Primeiro implemente:

estrutura do projeto;

Supabase;

banco;

autenticação;

dashboard;

cadastro de leads;

importação CSV;

colagem de dados;

deduplicação;

filtros;

score;

prioridades;

templates;

mensagens;

WhatsApp;

Instagram;

LinkedIn;

follow-up;

exportação XLSX/CSV.

Não implementar integrações externas pagas nesta etapa.

Antes de finalizar, faça uma verificação completa de:

TypeScript;

erros de build;

RLS;

queries Supabase;

responsividade;

importação;

deduplicação;

geração de WhatsApp;

exportação.

O sistema deve estar funcional e utilizável após a primeira geração.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://prospect7tek.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e4b13e79-f36e-48b7-b711-e8c07ce929fa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
