// Gerador de palavras cruzadas: encaixa palavras numa grade maximizando cruzamentos.
(function () {
  function rngDe(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashTexto(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function embaralhar(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Tenta montar uma grade. dir: 0 = horizontal, 1 = vertical
  function montar(lista, alvo, maxDim, rng) {
    const cel = new Map(); // "l,c" -> {ch, h, v}
    const postas = [];
    let minL = 0, maxL = 0, minC = 0, maxC = 0;
    const key = (l, c) => l + ',' + c;
    const get = (l, c) => cel.get(key(l, c));

    function cabe(w, l, c, dir) {
      const dl = dir ? 1 : 0, dc = dir ? 0 : 1;
      // antes e depois da palavra precisam estar vazios
      if (get(l - dl, c - dc) || get(l + dl * w.length, c + dc * w.length)) return -1;
      let cruz = 0;
      for (let k = 0; k < w.length; k++) {
        const ll = l + dl * k, cc = c + dc * k;
        const e = get(ll, cc);
        if (e) {
          if (e.ch !== w[k] || (dir ? e.v : e.h)) return -1;
          cruz++;
        } else {
          // vizinhos laterais vazios (evita palavras grudadas formando lixo)
          if (get(ll + dc, cc + dl) || get(ll - dc, cc - dl)) return -1;
        }
      }
      const nl0 = Math.min(minL, l), nl1 = Math.max(maxL, l + dl * (w.length - 1));
      const nc0 = Math.min(minC, c), nc1 = Math.max(maxC, c + dc * (w.length - 1));
      if (nl1 - nl0 + 1 > maxDim || nc1 - nc0 + 1 > maxDim) return -1;
      return cruz;
    }
    function por(ent, l, c, dir) {
      const w = ent.w, dl = dir ? 1 : 0, dc = dir ? 0 : 1;
      for (let k = 0; k < w.length; k++) {
        const ll = l + dl * k, cc = c + dc * k, kk = key(ll, cc);
        const e = cel.get(kk) || { ch: w[k], h: false, v: false };
        if (dir) e.v = true; else e.h = true;
        cel.set(kk, e);
      }
      minL = Math.min(minL, l); maxL = Math.max(maxL, l + dl * (w.length - 1));
      minC = Math.min(minC, c); maxC = Math.max(maxC, c + dc * (w.length - 1));
      postas.push({ ...ent, l, c, dir });
    }

    const primeira = lista[0];
    por(primeira, 0, -Math.floor(primeira.w.length / 2), rng() < 0.5 ? 0 : 1);
    let cruzTotal = 0;
    const restantes = lista.slice(1);
    for (let passo = 0; passo < 2 && postas.length < alvo; passo++) {
      for (let i = 0; i < restantes.length && postas.length < alvo; i++) {
        const ent = restantes[i];
        if (!ent || postas.some((p) => p.w === ent.w)) continue;
        let melhor = null, melhorNota = -1;
        for (const [k, e] of cel) {
          const [l, c] = k.split(',').map(Number);
          for (let j = 0; j < ent.w.length; j++) {
            if (ent.w[j] !== e.ch) continue;
            for (const dir of [0, 1]) {
              if (dir ? e.v : e.h) continue;
              const sl = dir ? l - j : l, sc = dir ? c : c - j;
              const cruz = cabe(ent.w, sl, sc, dir);
              if (cruz < 1) continue;
              // prefere mais cruzamentos e grades compactas
              const nota = cruz * 10 - (Math.abs(sl) + Math.abs(sc)) * 0.15 + rng();
              if (nota > melhorNota) { melhorNota = nota; melhor = [sl, sc, dir, cruz]; }
            }
          }
        }
        if (melhor) { por(ent, melhor[0], melhor[1], melhor[2]); cruzTotal += melhor[3]; restantes[i] = null; }
      }
    }
    const altura = maxL - minL + 1, largura = maxC - minC + 1;
    return { postas, cruzTotal, altura, largura, minL, minC };
  }

  /**
   * Gera uma cruzada.
   * @param {Array} candidatas entradas {w, d, c, cat}
   * @param {Object} o { alvo, maxDim, seed, tentativas }
   */
  function gerarCruzada(candidatas, o) {
    const rng = rngDe(o.seed || 1);
    const alvo = o.alvo || 12, maxDim = o.maxDim || 13;
    let melhor = null, melhorNota = -Infinity;
    const tent = o.tentativas || 40;
    for (let t = 0; t < tent; t++) {
      // escolhe palavras e ordena: longas primeiro (com variação)
      const amostra = embaralhar(candidatas, rng).slice(0, Math.min(candidatas.length, alvo * 4));
      amostra.sort((a, b) => b.w.length - a.w.length + (rng() - 0.5) * 4);
      const r = montar(amostra, alvo, maxDim, rng);
      const nota = r.postas.length * 100 + r.cruzTotal * 8 - r.altura * r.largura * 0.4;
      if (nota > melhorNota) { melhorNota = nota; melhor = r; }
      if (r.postas.length >= alvo && t > tent / 3) break;
    }
    return finalizar(melhor);
  }

  // Normaliza coordenadas, monta a matriz e numera as palavras
  function finalizar(r) {
    const palavras = r.postas.map((p) => ({ ...p, l: p.l - r.minL, c: p.c - r.minC }));
    const grade = Array.from({ length: r.altura }, () => Array(r.largura).fill(null));
    for (const p of palavras) for (let k = 0; k < p.w.length; k++) grade[p.l + (p.dir ? k : 0)][p.c + (p.dir ? 0 : k)] = p.w[k];
    const inicios = [...new Set(palavras.map((p) => p.l * 1000 + p.c))].sort((a, b) => a - b);
    for (const p of palavras) p.num = inicios.indexOf(p.l * 1000 + p.c) + 1;
    palavras.sort((a, b) => a.dir - b.dir || a.num - b.num);
    palavras.forEach((p, i) => (p.id = i));
    return { grade, altura: r.altura, largura: r.largura, palavras };
  }

  window.Gerador = { gerarCruzada, rngDe, hashTexto, embaralhar };
})();
