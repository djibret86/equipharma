/* EQUIPHARMA — application v1
   Licence : AGPL-3.0 — https://github.com/djibret86/equipharma
   Tout fonctionne dans le navigateur, sans serveur : la base est lue depuis
   data/medicaments.csv. Remplacer ce fichier suffit à mettre à jour les données. */
(function () {
  "use strict";

  // ---------- Réglages ----------
  const CONFIG = {
    dataUrl: "data/medicaments.csv",
    metaUrl: "data/meta.json",
    repo: "djibret86/equipharma",   // dépôt GitHub du projet (signalements)
    reportEmail: "",                // facultatif : adresse qui reçoit les signalements
    reportWhatsApp: "2250758335747", // numéro WhatsApp du projet (international, sans "+")
    suspectAbove: 500000,           // au-delà (FCFA), un prix est considéré comme à vérifier
    maxResults: 60,
  };

  const $ = (sel) => document.querySelector(sel);
  const view = $("#view");
  const q = $("#q");
  const clearBtn = $("#clear");
  const backBtn = $("#back");

  let MEDS = [];                 // tous les médicaments
  const byId = new Map();
  const byDci = new Map();       // DCI -> [médicaments]
  let META = {};
  let EXAMPLES = [];

  // ---------- Outils ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmt = (n) => n.toLocaleString("fr-FR");
  const doseKey = (d) => norm(d).replace(/\s+/g, "");
  const title = (s) => String(s || "").toLowerCase()
    .replace(/(^|[\s\-/(+.])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
  const sentence = (s) => { s = String(s || "").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

  // Lecture CSV (gère les guillemets et les virgules dans les champs)
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const rows = []; let row = []; let field = ""; let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const head = rows.shift() || [];
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
  }

  function etatOf(raw) {
    const e = norm(raw);
    if (!e) return { kind: "unk", label: "Disponibilité non renseignée" };
    if (e.includes("non confirm")) return { kind: "unk", label: "Disponibilité non confirmée" };
    if (e.startsWith("disponible")) return { kind: "ok", label: "Disponible" };
    if (e.startsWith("indisponible")) return { kind: "warn", label: "Indisponible" };
    if (e.startsWith("arret")) return { kind: "bad", label: "Arrêt de commercialisation" };
    return { kind: "unk", label: "Disponibilité non confirmée" };
  }

  function typeOf(raw) {
    const t = norm(raw);
    if (t.startsWith("spec")) return "R";
    if (t.startsWith("equi")) return "E";
    return "X";
  }
  // Quantité contenue dans le conditionnement, pour comparer au prix unitaire.
  // "B/30" → 30 unités · "10 BL/10" → 100 unités · "FL/60ml" → 60 ml · "T/15g" → 15 g
  function qtyOf(pack) {
    const p = String(pack || "").toUpperCase().replace(/\s+/g, " ").trim();
    let r;
    if ((r = p.match(/^(\d+) ?BL ?\/? ?(\d+)$/))) return { n: +r[1] * +r[2], u: "u" };
    if ((r = p.match(/^[BT] ?\/ ?(\d+)$/))) return { n: +r[1], u: "u" };
    if ((r = p.match(/^(?:FL|T|B|SACHET|PDRE)? ?\/? ?(\d+(?:[.,]\d+)?) ?ML$/))) return { n: parseFloat(r[1].replace(",", ".")), u: "ml" };
    if ((r = p.match(/^(?:T|POT|FL)? ?\/? ?(\d+(?:[.,]\d+)?) ?G$/))) return { n: parseFloat(r[1].replace(",", ".")), u: "g" };
    return null;
  }
  const UNIT_WORD = { u: "unité", ml: "ml", g: "g" };

  const TYPE_LABEL = { R: "RÉF", E: "GÉN", X: "?" };
  const TYPE_LONG = { R: "Spécialité de référence", E: "Équivalent (générique)", X: "Type non renseigné" };

  function buildIndex(rows) {
    const seen = new Set();
    rows.forEach((r) => {
      const key = [r.DCI, r.Nom_commercial, r.Dosage, r.Forme, r.Conditionnement, r.Prix_FCFA].join("|");
      if (seen.has(key)) return;           // doublon exact : ignoré
      seen.add(key);
      const p = parseInt(String(r.Prix_FCFA).replace(/[^0-9]/g, ""), 10);
      const price = Number.isFinite(p) && p > 0 ? p : null;
      const m = {
        id: MEDS.length,
        dci: r.DCI || "",
        name: r.Nom_commercial || "(sans nom)",
        dose: r.Dosage || "",
        form: r.Forme || "",
        pack: r.Conditionnement || "",
        type: typeOf(r.Type),
        etat: etatOf(r.Etat),
        price,
        suspect: price != null && (price > CONFIG.suspectAbove || /oui/i.test(r.Prix_suspect || "")),
        ean: r.EAN || "",
        classe: r.Classe || "",
      };
      m.q = qtyOf(m.pack);
      m.unit = m.price != null && m.q && m.q.n > 0 ? m.price / m.q.n : null;
      m.hosp = /\bCH\b/.test(m.name.toUpperCase());   // conditionnement hospitalier
      m.dk = doseKey(m.dose);
      m.s = norm(m.name) + " " + norm(m.dci);
      m.sn = norm(m.name); m.sd = norm(m.dci);
      MEDS.push(m); byId.set(m.id, m);
      if (!byDci.has(m.dci)) byDci.set(m.dci, []);
      byDci.get(m.dci).push(m);
    });
  }

  // Un prix utilisable pour comparer : connu, plausible, vendu au public, pas retiré/indisponible
  const priced = (m) => m.price != null && !m.suspect && !m.hosp;
  const usable = (m) => priced(m) && m.etat.kind !== "bad" && m.etat.kind !== "warn";
  const byPrice = (a, b) => (a.price == null) - (b.price == null) || (a.price || 0) - (b.price || 0) || a.name.localeCompare(b.name);

  // Analyse d'un groupe (même molécule, même dosage).
  // Si les quantités sont connues, on compare au prix unitaire ; sinon au prix de la boîte.
  function analyse(items) {
    const cand = items.filter(priced);
    const units = {};
    cand.forEach((m) => { if (m.unit != null) units[m.q.u] = (units[m.q.u] || 0) + 1; });
    const u = Object.keys(units).sort((a, b) => units[b] - units[a])[0];
    const mode = u && units[u] >= 2 ? "unit" : "box";
    const val = mode === "unit" ? (m) => (m.unit != null && m.q.u === u ? m.unit : null) : (m) => m.price;
    const comparable = (m) => val(m) != null;
    const ok = items.filter((m) => usable(m) && comparable(m));
    const cheapest = ok.length ? ok.reduce((a, b) => (val(b) < val(a) ? b : a)) : null;
    const refs = items.filter((m) => m.type === "R" && priced(m) && comparable(m));
    const refMax = refs.length ? refs.reduce((a, b) => (val(b) > val(a) ? b : a)) : null;
    let save = 0;
    if (cheapest && refMax && cheapest.type !== "R" && val(refMax) > val(cheapest))
      save = Math.round((100 * (val(refMax) - val(cheapest))) / val(refMax));
    // Ordre d'affichage : comparables du moins cher au plus cher, puis le reste
    const sorted = items.slice().sort((a, b) => {
      const va = priced(a) ? val(a) : null, vb = priced(b) ? val(b) : null;
      return (va == null) - (vb == null) || (va || 0) - (vb || 0) || byPrice(a, b);
    });
    return { cheapest, refMax, save, mode, unit: u, val, sorted };
  }

  function groupsOf(dci) {
    const map = new Map();
    (byDci.get(dci) || []).forEach((m) => {
      if (!map.has(m.dk)) map.set(m.dk, { dose: m.dose || "Dosage non précisé", items: [] });
      map.get(m.dk).items.push(m);
    });
    return [...map.values()].map((g) => Object.assign(g, analyse(g.items)));
  }

  // ---------- Briques d'affichage ----------
  const fmtUnit = (v, u) => (v >= 10 ? fmt(Math.round(v)) : v.toFixed(1).replace(".", ",")) + " FCFA/" + UNIT_WORD[u];
  function priceHtml(m) {
    if (m.price == null) return '<span class="price na">prix non renseigné</span>';
    return '<span class="price">' + fmt(m.price) + "<small>FCFA</small></span>" +
      (m.unit != null ? '<span class="unitp">' + fmtUnit(m.unit, m.q.u) + "</span>" : "");
  }
  // Phrase d'économie d'un groupe : référence la plus chère contre option la moins chère
  function savingText(g) {
    const c = g.cheapest, r = g.refMax;
    if (g.mode === "unit")
      return "<b>" + esc(title(c.name)) + "</b> revient à " + fmtUnit(g.val(c), g.unit) + ", contre " +
        fmtUnit(g.val(r), g.unit) + " pour " + esc(title(r.name)) + ".";
    return "<b>" + esc(title(c.name)) + "</b> à " + fmt(c.price) + " FCFA, contre " + esc(title(r.name)) + " à " + fmt(r.price) + " FCFA.";
  }
  const pill = (m) => '<span class="pill ' + m.etat.kind + '">' + esc(m.etat.label) + "</span>";

  function rowHtml(m, opts) {
    opts = opts || {};
    const flags = [];
    if (opts.best) flags.push('<span class="flag">le moins cher</span>');
    if (opts.current) flags.push('<span class="flag you">ce médicament</span>');
    if (m.suspect) flags.push('<span class="flag check">prix à vérifier</span>');
    if (m.hosp) flags.push('<span class="flag you">boîte hospitalière</span>');
    const sub = opts.short
      ? [m.form, m.pack].filter(Boolean).map(title).join(" · ")
      : [sentence(m.dci), m.dose, title(m.form)].filter(Boolean).join(" · ");
    return '<button class="row' + (opts.best ? " best" : "") + (opts.current ? " current" : "") +
      '" type="button" data-med="' + m.id + '">' +
      '<span class="tag ' + m.type + '" title="' + TYPE_LONG[m.type] + '">' + TYPE_LABEL[m.type] + "</span>" +
      '<span class="row-main"><span class="row-name">' + esc(title(m.name)) + "</span>" +
      '<span class="row-sub">' + esc(sub) + "</span>" +
      (flags.length ? '<span class="row-sub">' + flags.join(" ") + "</span>" : "") + "</span>" +
      '<span class="row-side">' + priceHtml(m) + pill(m) + "</span></button>";
  }

  const WARNING = '<p class="warning">Information à but documentaire. Elle ne remplace pas l\'avis d\'un pharmacien ou d\'un médecin : tout changement de médicament doit être validé par un professionnel de santé. Prix indicatifs, à vérifier en pharmacie.</p>';

  // ---------- Vues ----------
  function renderHome() {
    const nbDci = byDci.size;
    let h = '<section class="hero"><h1>Trouvez un équivalent moins cher</h1>' +
      '<p class="lead">Tapez le nom d\'un médicament ou d\'une molécule : EQUIPHARMA affiche ses équivalents et compare les prix, à dosage égal.</p></section>';
    h += '<div class="stats"><span><b>' + fmt(MEDS.length) + "</b> médicaments</span><span><b>" + fmt(nbDci) +
      "</b> molécules</span><span>Données : " + esc(META.date_donnees_txt || "base d'origine ~2013") + "</span></div>";
    if (EXAMPLES.length) {
      h += '<section><p class="label">Exemples à essayer</p><div class="chips">';
      EXAMPLES.forEach((d) => { h += '<button class="chip" type="button" data-dci="' + esc(d) + '">' + esc(sentence(d)) + "</button>"; });
      h += "</div></section>";
    }
    h += '<section><p class="label">Comment ça marche</p><ol class="steps">' +
      "<li>Cherchez votre médicament.</li>" +
      "<li>Ouvrez sa fiche : vous voyez les équivalents du même dosage, du moins cher au plus cher.</li>" +
      "<li>Demandez conseil à votre pharmacien avant tout changement.</li></ol></section>";
    h += WARNING;
    view.innerHTML = h;
  }

  function search(term) {
    const words = norm(term).split(/\s+/).filter(Boolean);
    if (!words.length) return { meds: [], dcis: [] };
    const hits = [];
    for (const m of MEDS) {
      if (!words.every((w) => m.s.includes(w))) continue;
      const w0 = words[0];
      const score = m.sn.startsWith(w0) ? 0 : m.sd.startsWith(w0) ? 1 : 2;
      hits.push([score, m]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name) || byPrice(a[1], b[1]));
    const dcis = [...byDci.keys()].filter((d) => d && words.every((w) => norm(d).includes(w)))
      .sort((a, b) => a.length - b.length).slice(0, 3);
    return { meds: hits.map((x) => x[1]), dcis };
  }

  function renderSearch(term) {
    const res = search(term);
    if (!res.meds.length) {
      view.innerHTML = '<p class="empty">Aucun médicament trouvé pour « ' + esc(term) +
        ' ».<br>Vérifiez l\'orthographe ou essayez le nom de la molécule.</p>' +
        '<div class="actions"><button class="btn" type="button" data-report="missing">Signaler un médicament manquant</button></div>';
      return;
    }
    let h = "";
    if (res.dcis.length) {
      h += '<section><p class="label">Molécule</p><div class="list">';
      res.dcis.forEach((d) => {
        const n = byDci.get(d).length;
        h += '<button class="row" type="button" data-dci="' + esc(d) + '"><span class="tag X">DCI</span>' +
          '<span class="row-main"><span class="row-name">' + esc(sentence(d)) + '</span><span class="row-sub">' +
          n + " présentation" + (n > 1 ? "s" : "") + " · voir tous les équivalents</span></span></button>";
      });
      h += "</div></section>";
    }
    const shown = res.meds.slice(0, CONFIG.maxResults);
    h += '<section><p class="label">' + fmt(res.meds.length) + " médicament" + (res.meds.length > 1 ? "s" : "") + '</p><div class="list">';
    shown.forEach((m) => { h += rowHtml(m); });
    h += "</div>";
    if (res.meds.length > shown.length) h += '<p class="more">Affinez la recherche pour voir les autres résultats.</p>';
    h += "</section>";
    view.innerHTML = h;
  }

  function renderMed(id) {
    const m = byId.get(id);
    if (!m) return renderHome();
    const groups = groupsOf(m.dci);
    const g = groups.find((x) => x.items.includes(m));
    const others = groups.filter((x) => x !== g).sort((a, b) => b.items.length - a.items.length);

    let h = '<section class="sheet-head"><span class="tag ' + m.type + '" style="align-self:flex-start">' + TYPE_LONG[m.type] + "</span>" +
      "<h1>" + esc(title(m.name)) + "</h1>" +
      '<button class="dci-link" type="button" data-dci="' + esc(m.dci) + '">' + esc(sentence(m.dci) || "Molécule non renseignée") + "</button></section>";

    h += '<dl class="facts">' +
      "<div><dt>Prix</dt><dd>" + (m.price != null ? '<span class="num">' + fmt(m.price) + "</span> FCFA" : "Non renseigné") + "</dd></div>" +
      "<div><dt>Disponibilité</dt><dd>" + pill(m) + "</dd></div>" +
      "<div><dt>Dosage</dt><dd>" + esc(m.dose || "—") + "</dd></div>" +
      "<div><dt>Forme</dt><dd>" + esc(title(m.form) || "—") + "</dd></div>" +
      "<div><dt>Conditionnement</dt><dd>" + esc(m.pack || "—") + "</dd></div>" +
      "<div><dt>Code-barres</dt><dd>" + (m.ean ? '<span class="num">' + esc(m.ean) + "</span>" : "—") + "</dd></div>" +
      (m.classe ? '<div class="wide"><dt>Classe</dt><dd>' + esc(sentence(m.classe)) + "</dd></div>" : "") +
      "</dl>";

    if (m.suspect) h += '<p class="note">Le prix de ce médicament semble anormal dans la base. Il est exclu des comparaisons en attendant vérification.</p>';

    // Conseil prix (F5)
    const c = g.cheapest;
    const vm = priced(m) ? g.val(m) : null;
    const cheapTxt = c ? "<b>" + esc(title(c.name)) + "</b> à " + fmt(c.price) + " FCFA" +
      (g.mode === "unit" ? " (" + fmtUnit(g.val(c), g.unit) + ")" : "") : "";
    if (c && c !== m && vm != null && g.val(c) < vm) {
      const pct = Math.round((100 * (vm - g.val(c))) / vm);
      const how = g.mode === "unit"
        ? "revient à " + fmtUnit(g.val(c), g.unit) + ", contre " + fmtUnit(vm, g.unit) + " pour ce médicament."
        : "coûte " + fmt(c.price) + " FCFA, contre " + fmt(m.price) + " FCFA.";
      h += '<section class="save"><div class="big">−' + pct + " %</div><p>Pour le même dosage (" + esc(g.dose) + "), <b>" +
        esc(title(c.name)) + "</b> " + how + "</p>" +
        '<button type="button" data-med="' + c.id + '">Voir ' + esc(title(c.name)) + "</button></section>";
    } else if (c && c === m) {
      h += '<p class="note good">C\'est l\'option la moins chère connue pour ce dosage (' + esc(g.dose) + ").</p>";
    } else if (m.hosp && c) {
      h += '<p class="note">Conditionnement hospitalier : en général non vendu au détail. Option grand public la moins chère pour ce dosage : ' + cheapTxt + ".</p>";
    } else if (m.price == null && c) {
      h += '<p class="note">Prix non renseigné pour ce médicament. Le moins cher connu pour ce dosage est ' + cheapTxt + ".</p>";
    } else if (c && c !== m) {
      h += '<p class="note">Option la moins chère connue pour ce dosage : ' + cheapTxt + ".</p>";
    }
    if (g.mode === "unit")
      h += '<p class="lead" style="font-size:13px;margin-top:-8px">Comparaison au prix par ' + UNIT_WORD[g.unit] + ", car les boîtes n'ont pas toutes la même taille.</p>";

    // Équivalents du même dosage (F4)
    const same = g.sorted;
    h += '<section><p class="label">Même molécule, même dosage · ' + esc(g.dose) + "</p>";
    if (same.length > 1) {
      const row = (x) => rowHtml(x, { short: true, best: x === c, current: x === m });
      const TOP = 8;
      h += '<div class="list">' + same.slice(0, TOP).map(row).join("") + "</div>";
      if (same.length > TOP)
        h += '<details class="group" style="margin-top:8px"><summary>Voir les ' + (same.length - TOP) + ' autres<span>plus chers ou sans prix</span></summary>' +
          '<div class="list">' + same.slice(TOP).map(row).join("") + "</div></details>";
    } else h += '<p class="note">Aucun équivalent de ce dosage dans la base pour l\'instant.</p>';
    h += "</section>";

    // Autres dosages
    if (others.length) {
      h += '<section><p class="label">Autres dosages de la molécule</p><div class="list">';
      others.forEach((o) => {
        h += '<details class="group"><summary>' + esc(o.dose) + "<span>" + o.items.length + " présentation" + (o.items.length > 1 ? "s" : "") +
          (o.save > 0 ? " · jusqu'à −" + o.save + " %" : "") + '</span></summary><div class="list">';
        o.sorted.forEach((x) => { h += rowHtml(x, { short: true, best: x === o.cheapest && o.items.length > 1 }); });
        h += "</div></details>";
      });
      h += "</div></section>";
    }

    h += WARNING;
    h += '<div class="actions"><button class="btn" type="button" data-report="' + m.id + '">Signaler une erreur ou un prix</button></div>';
    view.innerHTML = h;
  }

  function renderDci(dci) {
    const groups = groupsOf(dci).sort((a, b) => b.save - a.save || b.items.length - a.items.length);
    if (!groups.length) return renderHome();
    const all = byDci.get(dci);
    const nR = all.filter((m) => m.type === "R").length, nE = all.filter((m) => m.type === "E").length;
    let h = '<section class="sheet-head"><p class="label" style="margin:0">Molécule (DCI)</p><h1>' + esc(sentence(dci)) + "</h1>" +
      '<p class="lead">' + all.length + " présentation" + (all.length > 1 ? "s" : "") + " · " + nR + " référence" + (nR > 1 ? "s" : "") +
      " · " + nE + " générique" + (nE > 1 ? "s" : "") + "</p></section>";
    const top = groups[0];
    if (top.save > 0)
      h += '<section class="save"><div class="big">−' + top.save + " %</div><p>Dosage " + esc(top.dose) + " : " + savingText(top) + "</p></section>";
    groups.forEach((g, i) => {
      h += '<details class="group"' + (i < 2 ? " open" : "") + "><summary>" + esc(g.dose) + "<span>" + g.items.length + " présentation" +
        (g.items.length > 1 ? "s" : "") + (g.save > 0 ? " · jusqu'à −" + g.save + " %" : "") + '</span></summary><div class="list">';
      g.sorted.forEach((x) => { h += rowHtml(x, { short: true, best: x === g.cheapest && g.items.length > 1 }); });
      h += "</div></details>";
    });
    h += WARNING;
    view.innerHTML = h;
  }

  function renderAbout() {
    view.innerHTML = '<section class="prose">' +
      '<h1 style="font:700 24px var(--font-display)">À propos d\'EQUIPHARMA</h1>' +
      "<p>EQUIPHARMA relie chaque médicament vendu en Côte d'Ivoire à sa molécule (DCI) et à ses équivalents, pour aider chacun à trouver une option moins chère.</p>" +
      "<h2>Un projet ouvert</h2>" +
      "<p>Le code est libre (licence AGPL-3.0) et la base de données est ouverte (licence ODbL-1.0). Tout le monde peut la consulter, la corriger et l'enrichir.</p>" +
      '<p><a href="https://github.com/' + esc(CONFIG.repo) + '" target="_blank" rel="noopener">Voir le projet sur GitHub</a></p>' +
      "<h2>Neutralité</h2>" +
      "<p>Les équivalents sont classés uniquement par prix et disponibilité. Aucun classement n'est vendu.</p>" +
      "<h2>Les données</h2>" +
      "<p>" + fmt(MEDS.length) + " médicaments, " + fmt(byDci.size) + " molécules. " + esc(META.origine || "Base d'origine (~2013), nettoyée.") +
      " Dernière mise à jour : <b>" + esc(META.date_donnees_txt || "—") + "</b>. Les prix sont indicatifs et en cours de réactualisation.</p>" +
      "<h2>Auteur</h2>" +
      "<p>Projet conçu et initié par <b>Djibret DAKOURI</b>.</p>" +
      "<h2>Avertissement</h2>" + WARNING +
      '<p style="color:var(--ink-soft);font-size:12.5px">Version ' + esc(META.version || "1.0.0") + "</p></section>";
  }

  // "2250758335747" → "+225 07 58 33 57 47"
  const waDisplay = (n) => { const d = String(n).replace(/\D/g, ""); return d.startsWith("225") && d.length === 13
    ? "+225 " + d.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ") : "+" + d; };

  // Signalement (F9) — sans compte, sans serveur
  function renderReport(target) {
    const m = target === "missing" ? null : byId.get(Number(target));
    const name = m ? title(m.name) + (m.dose ? " " + m.dose : "") : "";
    view.innerHTML = '<section class="prose"><h1 style="font:700 24px var(--font-display)">Signaler une correction</h1>' +
      "<p class=\"lead\">Votre signalement aide toute la communauté. Indiquez toujours votre source.</p></section>" +
      '<form class="report" id="report-form" novalidate>' +
      '<div class="field"><label for="r-med">Médicament</label><input id="r-med" type="text" value="' + esc(name) + '" placeholder="Nom et dosage" required></div>' +
      '<div class="field"><label for="r-kind">Type de correction</label><select id="r-kind">' +
      "<option" + (m ? " selected" : "") + ">Prix qui a changé</option><option>Erreur d'équivalence ou de dosage</option>" +
      "<option" + (m ? "" : " selected") + ">Médicament manquant</option><option>Disponibilité (rupture, arrêt)</option><option>Autre</option></select></div>" +
      '<div class="field"><label for="r-fix">Correction</label><textarea id="r-fix" required placeholder="Ex. : le prix est maintenant de 2 500 FCFA"></textarea></div>' +
      '<div class="field"><label for="r-src">Source</label><input id="r-src" type="text" placeholder="Ex. : pharmacie du Plateau, le 12/10/2026"><span class="hint">Pharmacie, date, document… Une correction sans source ne peut pas être vérifiée.</span></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Préparer le signalement</button></div>' +
      '<p class="toast" id="r-msg" role="status"></p>' +
      "</form>" +
      '<section class="out" id="r-out" hidden></section>';
    $("#report-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const med = $("#r-med").value.trim(), fix = $("#r-fix").value.trim();
      if (!med || !fix) { $("#r-msg").textContent = "Indiquez le médicament et la correction."; return; }
      const kind = $("#r-kind").value, src = $("#r-src").value.trim() || "non précisée";
      const titleTxt = "[" + kind + "] " + med;
      const body = "Médicament : " + med + "\nType : " + kind + "\nCorrection : " + fix + "\nSource : " + src +
        (m ? "\n\nRéférence dans la base : " + m.dci + " | " + m.name + " | " + m.dose + " | " + m.form + " | " + (m.price != null ? m.price + " FCFA" : "prix non renseigné") : "");
      const gh = 'target="_blank" rel="noopener" href="https://github.com/' + esc(CONFIG.repo) +
        "/issues/new?title=" + encodeURIComponent(titleTxt) + "&body=" + encodeURIComponent(body) + '"';
      let links = "";
      if (CONFIG.reportWhatsApp)
        links += '<a class="btn primary" id="r-wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(CONFIG.reportWhatsApp) + "?text=" +
          encodeURIComponent(titleTxt + "\n" + body) + '">Envoyer par WhatsApp</a>';
      links += "<a class=\"btn" + (CONFIG.reportWhatsApp ? "" : " primary") + "\" id=\"r-gh\" " + gh + ">Envoyer sur GitHub</a>";
      if (CONFIG.reportEmail)
        links += '<a class="btn" href="mailto:' + esc(CONFIG.reportEmail) + "?subject=" + encodeURIComponent(titleTxt) + "&body=" + encodeURIComponent(body) + '">Envoyer par e-mail</a>';
      links += '<button class="btn" type="button" id="r-copy">Copier le texte</button>';
      const out = $("#r-out");
      out.innerHTML = '<p class="label" style="margin:0">Votre signalement</p><pre id="r-text">' + esc(titleTxt + "\n\n" + body) + "</pre>" +
        '<div class="actions">' + links + "</div>" +
        (CONFIG.reportWhatsApp ? '<p class="lead" style="font-size:13px">Si WhatsApp ne s\'ouvre pas, copiez le texte et envoyez-le au <span style="user-select:all;white-space:nowrap">' + esc(waDisplay(CONFIG.reportWhatsApp)) + "</span>.</p>" : "") +
        (CONFIG.reportEmail ? '<p class="lead" style="font-size:13px">Adresse : <span style="user-select:all">' + esc(CONFIG.reportEmail) + "</span></p>" : "");
      out.hidden = false;
      $("#r-msg").textContent = "Signalement prêt. Choisissez comment l'envoyer.";
      $("#r-copy").addEventListener("click", () => {
        const txt = titleTxt + "\n\n" + body;
        const done = () => { $("#r-msg").textContent = "Texte copié."; };
        const fallback = () => {
          const r = document.createRange(); r.selectNodeContents($("#r-text"));
          const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
          $("#r-msg").textContent = "Texte sélectionné : copiez-le avec votre téléphone.";
        };
        try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (err) { fallback(); }
      });
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ---------- Navigation ----------
  let current = { v: "home" };
  function render(state) {
    current = state || { v: "home" };
    switch (current.v) {
      case "search": renderSearch(current.q || ""); break;
      case "med": renderMed(current.id); break;
      case "dci": renderDci(current.dci); break;
      case "about": renderAbout(); break;
      case "report": renderReport(current.id); break;
      default: renderHome();
    }
    backBtn.hidden = current.v === "home";
    if (current.v !== "search") window.scrollTo(0, 0);
  }
  function go(state, replace) {
    state.d = replace ? (current.d || 0) : (current.d || 0) + 1;
    try { history[replace ? "replaceState" : "pushState"](state, ""); } catch (e) { /* environnement restreint */ }
    render(state);
  }

  window.addEventListener("popstate", (e) => {
    const s = e.state || { v: "home" };
    if (s.v === "search") { q.value = s.q || ""; } else if (s.v === "home") { q.value = ""; }
    clearBtn.hidden = !q.value;
    render(s);
  });
  backBtn.addEventListener("click", () => {
    if ((current.d || 0) > 0) history.back();
    else { q.value = ""; clearBtn.hidden = true; go({ v: "home" }, true); }
  });
  $("#home").addEventListener("click", () => { q.value = ""; clearBtn.hidden = true; go({ v: "home" }); });
  $("#about").addEventListener("click", () => go({ v: "about" }));

  let timer = null;
  q.addEventListener("input", () => {
    clearBtn.hidden = !q.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const term = q.value.trim();
      if (term.length < 2) { if (current.v === "search") go({ v: "home" }, true); return; }
      go({ v: "search", q: term }, current.v === "search");
    }, 120);
  });
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") q.blur(); });
  clearBtn.addEventListener("click", () => {
    q.value = ""; clearBtn.hidden = true; q.focus();
    go({ v: "home" }, current.v === "search");
  });

  // Délégation des clics dans la vue
  view.addEventListener("click", (e) => {
    const el = e.target.closest("[data-med],[data-dci],[data-report]");
    if (!el || el.tagName === "A") return;
    if (el.dataset.med != null) go({ v: "med", id: Number(el.dataset.med) });
    else if (el.dataset.dci != null) go({ v: "dci", dci: el.dataset.dci });
    else if (el.dataset.report != null) go({ v: "report", id: el.dataset.report });
  });

  // ---------- Démarrage ----------
  function pickExamples() {
    // Molécules où un générique fait vraiment économiser, avec le plus de choix
    const scored = [];
    byDci.forEach((items, dci) => {
      if (!dci || dci.length > 28) return;
      const best = Math.max(0, ...groupsOf(dci).map((g) => g.save));
      if (best >= 30) scored.push([items.length, dci]);
    });
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, 8).map((x) => x[1]);
  }

  async function start() {
    try {
      const [csv, meta] = await Promise.all([
        fetch(CONFIG.dataUrl).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
        fetch(CONFIG.metaUrl).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      META = meta || {};
      buildIndex(parseCSV(csv));
      EXAMPLES = pickExamples();
    } catch (err) {
      view.innerHTML = '<p class="empty">Impossible de charger la base de médicaments.<br>Vérifiez votre connexion puis rechargez la page.</p>';
      console.error(err);
      return;
    }
    try { history.replaceState({ v: "home", d: 0 }, ""); } catch (e) { /* environnement restreint */ }
    render({ v: "home", d: 0 });
  }

  // Hors-ligne (F8) : le service worker garde l'appli et la base en cache
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  start();
})();
