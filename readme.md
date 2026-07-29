# 🎲 Domino Online - Back-End

## 📌 Sobre o Projeto

O **Domino Online - Back-End** é o servidor responsável por toda a lógica da aplicação **Domino Online**. Ele gerencia a comunicação entre os jogadores, controla as partidas em tempo real e garante que todos os clientes permaneçam sincronizados durante o jogo.

Diferente do projeto **Domino Game**, que possuía toda a lógica concentrada no navegador, esta versão adota uma arquitetura **cliente-servidor**, separando as responsabilidades entre a interface (Front-End) e o servidor (Back-End). Essa abordagem torna a aplicação mais organizada, escalável e próxima das soluções utilizadas no mercado.

O servidor é responsável por processar os eventos enviados pelos jogadores, validar as ações realizadas durante a partida e transmitir essas informações para todos os participantes conectados.

---

# 🚀 Tecnologias Utilizadas

## 🟢 Node.js

O projeto foi desenvolvido utilizando **Node.js**, permitindo executar JavaScript e TypeScript no lado do servidor com alto desempenho.

Sua arquitetura orientada a eventos é ideal para aplicações que exigem comunicação constante entre clientes, como jogos online.

---

## ⚡ Express

O **Express** foi utilizado para estruturar o servidor da aplicação.

Ele é responsável por iniciar o servidor HTTP, configurar os recursos da aplicação e servir como base para a integração com o Socket.IO.

Sua simplicidade e flexibilidade tornam o desenvolvimento mais organizado e facilitam a manutenção do projeto.

---

## 🔷 TypeScript

Todo o servidor foi desenvolvido utilizando **TypeScript**, proporcionando maior segurança através da tipagem estática.

Essa tecnologia melhora a organização do código, reduz erros durante o desenvolvimento e facilita a evolução da aplicação conforme novas funcionalidades são implementadas.

---

## 🌐 Socket.IO

O **Socket.IO** é o principal responsável pela comunicação em tempo real entre o servidor e os jogadores.

Por meio dele, o servidor consegue:

* gerenciar conexões dos jogadores;
* criar e controlar salas de partidas;
* sincronizar as jogadas em tempo real;
* enviar atualizações do estado do jogo para todos os participantes;
* manter todos os clientes conectados com as mesmas informações durante a partida.

Essa comunicação ocorre instantaneamente, proporcionando uma experiência multiplayer fluida e dinâmica.

---

## 🔒 CORS

O **CORS (Cross-Origin Resource Sharing)** foi configurado para permitir que o Front-End se comunique com o servidor de forma segura, mesmo estando hospedado em uma origem diferente.

Essa configuração é fundamental em aplicações distribuídas, onde cliente e servidor são executados separadamente.

---

# 🎯 Objetivos Alcançados

O desenvolvimento deste servidor representou um grande avanço na minha formação como futuro **Desenvolvedor Full-Stack**.

Durante o projeto foi possível praticar conhecimentos como:

* desenvolvimento de servidores utilizando Node.js;
* criação de aplicações com Express;
* comunicação em tempo real utilizando Socket.IO;
* gerenciamento de conexões entre múltiplos usuários;
* arquitetura cliente-servidor;
* organização de aplicações back-end;
* utilização do TypeScript em projetos de servidor;
* sincronização de dados entre diversos clientes.

Além disso, este projeto permitiu compreender como jogos e aplicações colaborativas funcionam internamente, exigindo um servidor responsável por controlar toda a lógica da aplicação e manter os usuários sincronizados.

---

# 📈 Evolução em Relação ao Domino Game

Este projeto representa a maior evolução do **Domino Game**.

A aplicação deixou de depender apenas da execução local no navegador e passou a contar com um servidor dedicado, responsável por toda a comunicação entre os jogadores.

Essa mudança permitiu transformar um jogo local em uma aplicação multiplayer em tempo real, utilizando tecnologias amplamente empregadas no desenvolvimento de sistemas modernos.

---

# 🔗 Projetos Relacionados

### 💻 Repositório Back-End

> https://github.com/emilio-manoel/domino-online-back-end

### ⚛️ Repositório Front-End

> https://github.com/emilio-manoel/domino-online-front-end.

### 🌍 Aplicação Online

> https://emilio-manoel.github.io/domino-online-front-end/

---

# 🚀 Considerações

O **Domino Online - Back-End** representa um dos projetos mais importantes do meu portfólio, pois consolidou conhecimentos fundamentais sobre desenvolvimento de servidores, comunicação em tempo real e arquitetura de aplicações Full-Stack.

Sua construção fortaleceu minha experiência no desenvolvimento back-end e demonstrou minha capacidade de criar soluções robustas, escaláveis e preparadas para aplicações multiplayer, contribuindo significativamente para minha formação como **Desenvolvedor Full-Stack**.
