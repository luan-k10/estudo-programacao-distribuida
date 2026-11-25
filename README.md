# Estudo · Programação Distribuída e Paralela

Site interativo de estudo para a disciplina **Programação Distribuída e Paralela**, feito a partir dos slides do Prof. Jacques Oliveira (Multivix) e da Lista 1 de exercícios.

🔗 **Acesse:** https://luan-k10.github.io/estudo-programacao-distribuida/

## O que tem

- **Resumos** dos 7 temas, mais um quadro geral: princípios de sistemas distribuídos, threads e async/await, comunicação entre sistemas, arquiteturas e middleware, semáforos e mutex, Monitor e ManualResetEvent/AutoResetEvent. Cada tema traz tabelas, código C# e pegadinhas de prova.
- **Quiz**: 132 questões com explicação. Inclui a Lista 1 na ordem original, filtros por tema, "não respondidas" e "revisar erradas".
- **Simulado** cronometrado com nota, desempenho por tema e correção comentada
- **Flashcards** para revisão rápida (Espaço vira o card, ← → navega)
- **Discursivas** com resposta-modelo e checklist de pontos-chave
- **Laboratório** com simulações: race condition, semáforo/mutex, Manual × AutoResetEvent, síncrono × assíncrono (Task.WhenAll) e deadlock

Seu progresso e suas respostas ficam salvos no navegador (localStorage).

## Tecnologia

HTML, CSS e JavaScript puros, sem build. O visual segue o design do meu [portfólio](https://luan-k10.github.io), e o layout foi feito primeiro para celular.

Para rodar localmente, basta abrir `index.html` ou servir a pasta:

```bash
python -m http.server
```
