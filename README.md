# 🃏 Proxy Card Standard Creator

> Um gerador de folhas de impressão para cartas TCG (One Piece, Magic, Pokémon) com estética de Mangá e guias de corte automáticas.

![Project Status](https://img.shields.io/badge/status-active-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

## 📖 Sobre o Projeto

O **Proxy Card Standard Creator** é uma ferramenta web *client-side* (roda direto no navegador) desenvolvida para facilitar a vida de jogadores de TCG que precisam imprimir proxies para testes.

O diferencial deste projeto é sua interface estilizada com **estética de Mangá** (preto e branco, retículas, fontes japonesas) e a geração precisa de PDFs prontos para impressão em papel A4, já incluindo espaçamento e linhas de guia para corte.

### ✨ Funcionalidades

* **Design Responsivo & Temático:** Interface inspirada em painéis de mangá.
* **Upload Múltiplo:** Adicione várias imagens de cartas de uma vez.
* **Gerenciamento de Quantidade:** Defina quantas cópias de cada carta você deseja imprimir.
* **Previsão de Folhas:** Calculadora automática de quantas folhas A4 serão necessárias.
* **Geração de PDF Inteligente:**
    * Formato A4 Paisagem (Landscape).
    * 8 cartas por folha (4 colunas x 2 linhas).
    * Tamanho padrão TCG (63mm x 88mm).
    * **Guias de Corte:** Linhas pontilhadas entre as cartas para facilitar o uso de estilete/guilhotina.
    * Espaçamento de 4mm entre cartas (sangria segura).
* **Processamento Local:** Todas as imagens são processadas no seu navegador. Nenhuma imagem é enviada para servidores externos, garantindo privacidade e velocidade.

## 🚀 Como Usar

Não é necessária instalação de dependências ou servidores (Node.js, Python, etc). O projeto é um arquivo único.

1.  Baixe o arquivo `index.html` (ou clone este repositório).
2.  Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge).
3.  Clique em **"+ ADD CARDS"** e selecione as imagens das suas cartas.
4.  Ajuste a quantidade (`Qty`) de cada carta conforme necessário.
5.  Clique em **"DOWNLOAD PDF"**.
6.  Abra o PDF gerado e imprima em escala **100% (Tamanho Real)** para manter as medidas corretas.

## 🛠️ Tecnologias Utilizadas

* **HTML5 & CSS3:** Uso extensivo de CSS Variables (`:root`) e Flexbox/Grid para o layout.
* **JavaScript (Vanilla):** Lógica de manipulação do DOM e leitura de arquivos.
* **[jsPDF](https://github.com/parallax/jsPDF):** Biblioteca para geração dinâmica do arquivo PDF no navegador.
* **Google Fonts:** Noto Serif JP, Noto Sans JP e Zen Maru Gothic.

## ⚙️ Configurações Técnicas (Para Desenvolvedores)

Se você deseja alterar o tamanho das cartas (por exemplo, para cartas de Yu-Gi-Oh), você pode editar as constantes no início da tag `<script>`:

```javascript
const CARD_WIDTH = 63;  // Largura em mm
const CARD_HEIGHT = 88; // Altura em mm
const GAP = 4;          // Espaço entre as cartas em mm
