const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "factory_v45_syntax_cleared",
    resave: true,
    saveUninitialized: true,
  }),
);

// Chemin pour le disque dur permanent de Render, sinon dossier local
const dbPath = process.env.RENDER_DISK_PATH 
    ? `${process.env.RENDER_DISK_PATH}/gestion_pro_v2.db` 
    : './gestion_pro_v2.db';

const db = new sqlite3.Database('/tmp/gestion_pro_v2.db');// 1. INITIALISATION (BASE DE DONNÉES)
// ========================================================
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS Configuration (cle TEXT PRIMARY KEY, valeur TEXT)`,
  );
  const defConfigs = [
    ["nom_usine", "USINE EXPERT PRO"],
    ["adresse_usine", ""],
    ["tel_usine", ""],
    ["email_usine", ""],
    ["loyer_mois", "1200"],
    ["cout_elec_mois", "500"],
    ["amortissement_mois", "300"],
    ["charges_diverses_mois", "250"],
  ];
  defConfigs.forEach((c) =>
    db.run(`INSERT OR IGNORE INTO Configuration (cle, valeur) VALUES (?,?)`, c),
  );

  const schemaTiers = `id INTEGER PRIMARY KEY AUTOINCREMENT, entreprise TEXT, nom TEXT, prenom TEXT, adresse TEXT, telephone TEXT, email TEXT`;
  db.run(`CREATE TABLE IF NOT EXISTS Clients (${schemaTiers})`);
  db.run(`CREATE TABLE IF NOT EXISTS Fournisseurs (${schemaTiers})`);

  db.run(
    `CREATE TABLE IF NOT EXISTS Personnel (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, taux_horaire REAL)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS Avances (id INTEGER PRIMARY KEY AUTOINCREMENT, personnel_id INTEGER, montant REAL, date TEXT)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS Pointages (id INTEGER PRIMARY KEY AUTOINCREMENT, personnel_id INTEGER, date TEXT, heure_entree TEXT, heure_sortie TEXT, total_heures REAL)`,
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS Stocks (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, quantite_kg REAL DEFAULT 0)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS Produits (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, prix_unitaire REAL, conso_matiere REAL)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS Production (id INTEGER PRIMARY KEY AUTOINCREMENT, personnel_id INTEGER, produit_id INTEGER, stock_id INTEGER, quantite INTEGER, date TEXT)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS Achats (id INTEGER PRIMARY KEY AUTOINCREMENT, fournisseur_id INTEGER, stock_id INTEGER, quantite REAL, prix_unitaire REAL, prix_total REAL, date TEXT)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS Ventes (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, produit_id INTEGER, quantite INTEGER, prix_ligne REAL, date TEXT, numero_facture TEXT)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS Paiements (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, montant REAL, date TEXT)`,
  );
});

// ========================================================
// 2. DESIGN & MENU
// ========================================================
const css = `<style>
    :root { --blue: #0071e3; --bg: #f5f5f7; --card: #ffffff; --text: #1d1d1f; --red: #ff3b30; --grey: #86868b; --green: #34c759; }
    body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; height: 100vh; overflow: hidden; }
    .sidebar { width: 260px; background: #fff; border-right: 1px solid #d2d2d7; padding: 25px; display: flex; flex-direction: column; flex-shrink: 0; }
    .sidebar h2 { font-size: 16px; color: var(--blue); margin-bottom: 20px; text-transform: uppercase; }
    .sidebar a { text-decoration: none; color: #424245; padding: 10px 12px; border-radius: 10px; margin-bottom: 3px; font-size: 13px; transition: 0.2s; }
    .sidebar a:hover, .sidebar a.active { background: #f2f2f7; color: var(--blue); font-weight: 600; }
    .content { flex: 1; padding: 40px; overflow-y: auto; }
    .card { background: white; border-radius: 20px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e5e5e7; margin-bottom: 25px; }
    .btn { background: var(--blue); color: white; border: none; padding: 12px 20px; border-radius: 10px; cursor: pointer; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-flex; justify-content: center; align-items: center; min-width: 140px; box-sizing: border-box; box-shadow: 0 2px 5px rgba(0,0,0,0.1); transition: 0.2s; }
    .btn:hover { opacity: 0.9; }
    .btn-grey { background: #8e8e93 !important; }
    .btn-red { background: var(--red) !important; color: white !important;}
    .btn-green { background: var(--green) !important; color: white !important;}
    .btn-small { padding: 8px 12px; font-size: 11px; border-radius: 8px; background: #f2f2f7; color: var(--blue); text-decoration: none; margin-right: 5px; font-weight: bold; min-width: 80px; text-align: center; display: inline-block; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e5e5e7; transition: 0.2s; }
    .btn-small:hover { background: #e5e5e7; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px; color: var(--grey); font-size: 11px; border-bottom: 1px solid #eee; text-transform: uppercase; }
    td { padding: 12px; border-bottom: 1px solid #f9f9f9; font-size: 14px; }
    input, select { width: 100%; padding: 12px; margin: 8px 0; border-radius: 10px; border: 1px solid #d2d2d7; box-sizing: border-box; }
    label { font-size: 11px; font-weight: 700; color: var(--grey); text-transform: uppercase; margin-left:5px; }
    .cart-line { padding: 10px; background: #eef7ff; border-radius: 10px; margin-bottom: 5px; border-left: 5px solid var(--blue); font-weight: bold; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
</style>`;

const menu = (active) => `
<div class="sidebar">
    <h2>MA GESTION V45</h2>
    <a href="/" class="${active === "dash" ? "active" : ""}">📊 Dashboard</a>
    <a href="/paiements" class="${active === "pay" ? "active" : ""}">💰 Encaissements</a>
    <a href="/ventes" class="${active === "vente" ? "active" : ""}">💶 Facturation</a>
    <a href="/achats" class="${active === "ach" ? "active" : ""}">🛒 Achats Matières</a>
    <a href="/production" class="${active === "fab" ? "active" : ""}">⚙️ Production</a>
    <hr style="border:0; border-top:1px solid #eee; margin:10px 0;">
    <a href="/clients" class="${active === "client" ? "active" : ""}">👤 Clients</a>
    <a href="/fournisseurs" class="${active === "fourn" ? "active" : ""}">🚚 Fournisseurs</a>
    <a href="/stocks" class="${active === "stock" ? "active" : ""}">📦 Stocks Matières</a>
    <a href="/produits" class="${active === "prod" ? "active" : ""}">🏷️ Stocks Produits</a>
    <a href="/personnel" class="${active === "perso" ? "active" : ""}">👥 Personnel</a>
    <a href="/parametres" class="${active === "param" ? "active" : ""}">⚙️ Paramètres</a>
</div>`;

// ========================================================
// 3. FACTURATION & PANIER
// ========================================================
app.get("/ventes", (req, res) => {
  db.all(
    `SELECT numero_facture, date, Clients.entreprise as cEnt, SUM(prix_ligne) as total FROM Ventes LEFT JOIN Clients ON Ventes.client_id = Clients.id GROUP BY numero_facture ORDER BY Ventes.id DESC`,
    (err, rows) => {
      let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("vente")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Historique Factures</h1><a href="/nouvelle-facture" class="btn">+ Vendre</a></div><div class="card"><table><tr><th>N° Facture</th><th>Client</th><th>Total</th></tr>`;
      (rows || []).forEach((v) => {
        h += `<tr><td><b>${v.numero_facture}</b></td><td>${v.cEnt || "N/A"}</td><td>${v.total.toFixed(2)}€</td></tr>`;
      });
      res.send(h + `</table></div></div></body></html>`);
    },
  );
});

app.get("/nouvelle-facture", (req, res) => {
  req.session.panier = [];
  req.session.save(() => {
    db.all(`SELECT id, entreprise FROM Clients`, (err, rows) => {
      let opt = rows
        .map((c) => `<option value="${c.id}">${c.entreprise}</option>`)
        .join("");
      res.send(
        `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("vente")}<div class="content" style="max-width:500px;margin:auto;"><h1>Nouvelle Vente</h1><div class="card"><form action="/creer-session" method="POST"><label>Choisir Client</label><select name="cid">${opt}</select><br><br><button type="submit" class="btn">Démarrer</button></form></div></div></body></html>`,
      );
    });
  });
});

app.post("/creer-session", (req, res) => {
  req.session.client_actuel = req.body.cid;
  req.session.save(() => res.redirect("/panier"));
});

app.get("/panier", (req, res) => {
  db.all(`SELECT id, nom, prix_unitaire FROM Produits`, (err, prods) => {
    let opt = prods
      .map(
        (p) =>
          `<option value="${p.id}">${p.nom} (${p.prix_unitaire}€)</option>`,
      )
      .join("");
    let items = (req.session.panier || [])
      .map(
        (i) =>
          `<div class="cart-line">✅ ${i.nom} x ${i.qte} = ${i.tot.toFixed(2)}€</div>`,
      )
      .join("");
    res.send(
      `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("vente")}<div class="content" style="max-width:600px;margin:auto;"><h1>Articles</h1><div class="card"><h3>Panier actuel :</h3>${items || "<i>Vide</i>"}</div><form action="/ajouter-ligne" method="POST"><select name="pid">${opt}</select><input type="number" name="qte" value="1" min="1"><br><br><button type="submit" class="btn" style="background:orange">+ Ajouter au panier</button></form><br><br><a href="/valider-facture" class="btn btn-green" style="width:100%">✅ Finaliser la Facture</a></div></body></html>`,
    );
  });
});

app.post("/ajouter-ligne", (req, res) => {
  db.get(
    `SELECT nom, prix_unitaire FROM Produits WHERE id=?`,
    [req.body.pid],
    (err, p) => {
      if (!req.session.panier) req.session.panier = [];
      req.session.panier.push({
        id: req.body.pid,
        nom: p.nom,
        qte: req.body.qte,
        pu: p.prix_unitaire,
        tot: p.prix_unitaire * req.body.qte,
      });
      req.session.save(() => res.redirect("/panier"));
    },
  );
});

app.get("/valider-facture", (req, res) => {
  if (!req.session.panier || req.session.panier.length === 0)
    return res.redirect("/panier");
  const nF = "FAC-" + Date.now().toString().slice(-6);
  const date = new Date().toLocaleDateString("fr-FR");
  function saveItems(index) {
    if (index >= req.session.panier.length) {
      req.session.panier = [];
      req.session.save(() => res.redirect("/ventes"));
      return;
    }
    const it = req.session.panier[index];
    db.run(
      `INSERT INTO Ventes (client_id, produit_id, quantite, prix_ligne, date, numero_facture) VALUES (?,?,?,?,?,?)`,
      [req.session.client_actuel, it.id, it.qte, it.tot, date, nF],
      () => saveItems(index + 1),
    );
  }
  saveItems(0);
});

// ========================================================
// 4. TIERS (AJOUT, MODIF, SUPPRESSION)
// ========================================================
function tForm(type, label, action, d = {}) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:600px;margin:auto;"><h1>${label}</h1><div class="card"><form action="${action}" method="POST"><label>Entreprise</label><input type="text" name="ent" value="${d.entreprise || ""}" required><label>Nom</label><input type="text" name="nom" value="${d.nom || ""}"><label>Prénom</label><input type="text" name="pre" value="${d.prenom || ""}"><label>Tél</label><input type="text" name="tel" value="${d.telephone || ""}"><label>Adresse</label><input type="text" name="adr" value="${d.adresse || ""}"><label>Email</label><input type="text" name="em" value="${d.email || ""}"><br><br><button type="submit" class="btn">Enregistrer</button><a href="/${type}s" class="btn btn-grey" style="margin-left:10px;">Annuler</a></form></div></div></body></html>`;
}

// Clients
app.get("/clients", (req, res) => {
  db.all(`SELECT * FROM Clients`, (e, r) => {
    let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("client")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Clients</h1><a href="/ajouter-client" class="btn">+ Nouveau Client</a></div><div class="card"><table><tr><th>Entreprise</th><th>Contact</th><th>Tél</th><th>Actions</th></tr>`;
    (r || []).forEach((x) => {
      h += `<tr><td><b>${x.entreprise}</b></td><td>${x.nom} ${x.prenom}</td><td>${x.telephone}</td><td><a href="/modifier-client/${x.id}" class="btn-small">Modifier</a><a href="/supprimer-client/${x.id}" class="btn-small btn-red" onclick="return confirm('Supprimer ?')">Suppr.</a></td></tr>`;
    });
    res.send(h + `</table></div></div></body></html>`);
  });
});
app.get("/ajouter-client", (req, res) =>
  res.send(tForm("client", "Nouveau Client", "/sauver-client")),
);
app.post("/sauver-client", (req, res) =>
  db.run(
    `INSERT INTO Clients (entreprise,nom,prenom,adresse,telephone,email) VALUES (?,?,?,?,?,?)`,
    [
      req.body.ent,
      req.body.nom,
      req.body.pre,
      req.body.adr,
      req.body.tel,
      req.body.em,
    ],
    () => res.redirect("/clients"),
  ),
);
app.get("/modifier-client/:id", (req, res) =>
  db.get(`SELECT * FROM Clients WHERE id=?`, [req.params.id], (e, d) =>
    res.send(tForm("client", "Modifier Client", `/update-client/${d.id}`, d)),
  ),
);
app.post("/update-client/:id", (req, res) =>
  db.run(
    `UPDATE Clients SET entreprise=?, nom=?, prenom=?, adresse=?, telephone=?, email=? WHERE id=?`,
    [
      req.body.ent,
      req.body.nom,
      req.body.pre,
      req.body.adr,
      req.body.tel,
      req.body.em,
      req.params.id,
    ],
    () => res.redirect("/clients"),
  ),
);
app.get("/supprimer-client/:id", (req, res) =>
  db.run(`DELETE FROM Clients WHERE id=?`, [req.params.id], () =>
    res.redirect("/clients"),
  ),
);

// Fournisseurs
app.get("/fournisseurs", (req, res) => {
  db.all(`SELECT * FROM Fournisseurs`, (e, r) => {
    let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("fourn")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Fournisseurs</h1><a href="/ajouter-fournisseur" class="btn">+ Nouveau Fournisseur</a></div><div class="card"><table><tr><th>Entreprise</th><th>Contact</th><th>Tél</th><th>Actions</th></tr>`;
    (r || []).forEach((x) => {
      h += `<tr><td><b>${x.entreprise}</b></td><td>${x.nom} ${x.prenom}</td><td>${x.telephone}</td><td><a href="/modifier-fournisseur/${x.id}" class="btn-small">Modifier</a><a href="/supprimer-fournisseur/${x.id}" class="btn-small btn-red" onclick="return confirm('Supprimer ?')">Suppr.</a></td></tr>`;
    });
    res.send(h + `</table></div></div></body></html>`);
  });
});
app.get("/ajouter-fournisseur", (req, res) =>
  res.send(tForm("fournisseur", "Nouveau Fournisseur", "/sauver-fournisseur")),
);
app.post("/sauver-fournisseur", (req, res) =>
  db.run(
    `INSERT INTO Fournisseurs (entreprise,nom,prenom,adresse,telephone,email) VALUES (?,?,?,?,?,?)`,
    [
      req.body.ent,
      req.body.nom,
      req.body.pre,
      req.body.adr,
      req.body.tel,
      req.body.em,
    ],
    () => res.redirect("/fournisseurs"),
  ),
);
app.get("/modifier-fournisseur/:id", (req, res) =>
  db.get(`SELECT * FROM Fournisseurs WHERE id=?`, [req.params.id], (e, d) =>
    res.send(
      tForm(
        "fournisseur",
        "Modifier Fournisseur",
        `/update-fournisseur/${d.id}`,
        d,
      ),
    ),
  ),
);
app.post("/update-fournisseur/:id", (req, res) =>
  db.run(
    `UPDATE Fournisseurs SET entreprise=?, nom=?, prenom=?, adresse=?, telephone=?, email=? WHERE id=?`,
    [
      req.body.ent,
      req.body.nom,
      req.body.pre,
      req.body.adr,
      req.body.tel,
      req.body.em,
      req.params.id,
    ],
    () => res.redirect("/fournisseurs"),
  ),
);
app.get("/supprimer-fournisseur/:id", (req, res) =>
  db.run(`DELETE FROM Fournisseurs WHERE id=?`, [req.params.id], () =>
    res.redirect("/fournisseurs"),
  ),
);

// ========================================================
// 5. ENCAISSEMENTS & HISTORIQUE
// ========================================================
app.get("/paiements", (req, res) => {
  db.all(
    `SELECT C.entreprise, C.id, IFNULL((SELECT SUM(prix_ligne) FROM Ventes WHERE client_id = C.id), 0) as debit, IFNULL((SELECT SUM(montant) FROM Paiements WHERE client_id = C.id), 0) as credit FROM Clients C`,
    (err, rows) => {
      let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("pay")}<div class="content"><h1>Encaissements</h1><div class="card"><table><tr><th>Entreprise</th><th>Débit (Dû)</th><th>Crédit (Payé)</th><th>Solde</th><th>Actions</th></tr>`;
      (rows || []).forEach((r) => {
        let solde = r.debit - r.credit;
        h += `<tr><td><b>${r.entreprise}</b></td><td>${r.debit.toFixed(2)}€</td><td>${r.credit.toFixed(2)}€</td><td style="color:${solde > 0 ? "red" : "green"};font-weight:bold">${solde.toFixed(2)}€</td><td><a href="/nouveau-paiement?cid=${r.id}" class="btn-small">Encaisser</a><a href="/historique-paiements/${r.id}" class="btn-small" style="background:#d1d1d6; color:black">Détails</a></td></tr>`;
      });
      res.send(h + `</table></div></div></body></html>`);
    },
  );
});

app.get("/historique-paiements/:cid", (req, res) => {
  db.get(
    `SELECT entreprise FROM Clients WHERE id=?`,
    [req.params.cid],
    (e, c) => {
      db.all(
        `SELECT * FROM Paiements WHERE client_id=? ORDER BY id DESC`,
        [req.params.cid],
        (e, rows) => {
          let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("pay")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Historique : ${c.entreprise}</h1><a href="/paiements" class="btn btn-grey">Retour</a></div><div class="card"><table><tr><th>Date du versement</th><th>Montant reçu</th></tr>`;
          if (rows.length === 0)
            h += `<tr><td colspan="2"><i>Aucun versement enregistré.</i></td></tr>`;
          rows.forEach((r) => {
            h += `<tr><td>${r.date}</td><td><b>${r.montant.toFixed(2)}€</b></td></tr>`;
          });
          res.send(h + `</table></div></div></body></html>`);
        },
      );
    },
  );
});

app.get("/nouveau-paiement", (req, res) => {
  db.all(`SELECT id, entreprise FROM Clients`, (err, rows) => {
    let opt = rows
      .map(
        (c) =>
          `<option value="${c.id}" ${req.query.cid == c.id ? "selected" : ""}>${c.entreprise}</option>`,
      )
      .join("");
    res.send(
      `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Encaisser</h1><div class="card"><form action="/sauver-paiement" method="POST"><select name="cid">${opt}</select><input type="number" step="0.01" name="mt" placeholder="Montant (€)" required><br><br><button type="submit" class="btn">Valider</button></form></div></div></body></html>`,
    );
  });
});

app.post("/sauver-paiement", (req, res) => {
  db.run(
    `INSERT INTO Paiements (client_id, montant, date) VALUES (?,?,?)`,
    [req.body.cid, req.body.mt, new Date().toLocaleDateString("fr-FR")],
    () => res.redirect("/paiements"),
  );
});

// ========================================================
// 6. STOCKS & PRODUITS (PRIX MODIFIABLE)
// ========================================================
app.get("/stocks", (req, res) => {
  db.all(`SELECT * FROM Stocks`, (e, r) => {
    let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("stock")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Stocks Matières</h1><a href="/ajouter-matiere" class="btn">+ Créer Matière</a></div><div class="card"><table><tr><th>Matière</th><th>Qté Globale</th></tr>`;
    (r || []).forEach((s) => {
      h += `<tr><td><b>${s.nom}</b></td><td><span style="color:${s.quantite_kg <= 0 ? "var(--red)" : "var(--green)"}; font-weight:bold; font-size:15px;">${s.quantite_kg.toFixed(2)} kg</span></td></tr>`;
    });
    res.send(h + `</table></div></div></body></html>`);
  });
});
app.get("/ajouter-matiere", (req, res) =>
  res.send(
    `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Matière</h1><div class="card"><form action="/sauver-matiere" method="POST"><input type="text" name="nom" required><br><br><button type="submit" class="btn">Enregistrer</button></form></div></div></body></html>`,
  ),
);
app.post("/sauver-matiere", (req, res) =>
  db.run(
    `INSERT INTO Stocks (nom, quantite_kg) VALUES (?, 0)`,
    [req.body.nom],
    () => res.redirect("/stocks"),
  ),
);

app.get("/produits", (req, res) => {
  db.all(
    `SELECT p.*, (IFNULL((SELECT SUM(quantite) FROM Production WHERE produit_id = p.id), 0) - IFNULL((SELECT SUM(quantite) FROM Ventes WHERE produit_id = p.id), 0)) as stock_reel FROM Produits p`,
    (e, r) => {
      let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("prod")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Produits Finis</h1><a href="/ajouter-produit" class="btn">+ Nouveau Produit</a></div><div class="card"><table><tr><th>Produit</th><th>Prix</th><th>Stock</th><th>Actions</th></tr>`;
      (r || []).forEach((p) => {
        h += `<tr><td><b>${p.nom}</b></td><td>${p.prix_unitaire.toFixed(2)}€</td><td><span style="color:${p.stock_reel <= 0 ? "var(--red)" : "var(--blue)"}; font-weight:bold; font-size:15px;">${p.stock_reel} unités</span></td><td><a href="/modifier-produit/${p.id}" class="btn-small">Modifier Prix</a></td></tr>`;
      });
      res.send(h + `</table></div></div></body></html>`);
    },
  );
});
app.get("/ajouter-produit", (req, res) =>
  res.send(
    `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Produit</h1><div class="card"><form action="/sauver-produit" method="POST"><label>Nom</label><input type="text" name="nom" required><label>Prix</label><input type="number" step="0.01" name="prix" required><label>Conso kg</label><input type="number" step="0.001" name="conso" required><br><br><button type="submit" class="btn">Enregistrer</button></form></div></div></body></html>`,
  ),
);
app.post("/sauver-produit", (req, res) =>
  db.run(
    `INSERT INTO Produits (nom, prix_unitaire, conso_matiere) VALUES (?,?,?)`,
    [req.body.nom, req.body.prix, req.body.conso],
    () => res.redirect("/produits"),
  ),
);

// MODIFIER PRIX PRODUIT
app.get("/modifier-produit/:id", (req, res) => {
  db.get(`SELECT * FROM Produits WHERE id=?`, [req.params.id], (e, d) => {
    res.send(
      `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Modifier Produit</h1><div class="card"><form action="/update-produit/${d.id}" method="POST"><label>Nom</label><input type="text" name="nom" value="${d.nom}" required><label>Prix de Vente (€)</label><input type="number" step="0.01" name="prix" value="${d.prix_unitaire}" required><label>Consommation (kg)</label><input type="number" step="0.001" name="conso" value="${d.conso_matiere}" required><br><br><button type="submit" class="btn">Mettre à jour</button><a href="/produits" class="btn btn-grey" style="margin-left:10px;">Annuler</a></form></div></div></body></html>`,
    );
  });
});
app.post("/update-produit/:id", (req, res) =>
  db.run(
    `UPDATE Produits SET nom=?, prix_unitaire=?, conso_matiere=? WHERE id=?`,
    [req.body.nom, req.body.prix, req.body.conso, req.params.id],
    () => res.redirect("/produits"),
  ),
);

// ========================================================
// 7. PERSONNEL (POINTAGE & PAIE)
// ========================================================
app.get("/personnel", (req, res) => {
  db.all(`SELECT * FROM Personnel`, (e, r) => {
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("perso")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Personnel</h1><a href="/ajouter-employe" class="btn">+ Nouvel Employé</a></div><div class="card"><table><tr><th>Nom</th><th>Taux</th><th>Actions</th></tr>`;
    (r || []).forEach((s) => {
      html += `<tr><td><b>${s.nom}</b></td><td>${s.taux_horaire}€/h</td><td><a href="/pointage/${s.id}" class="btn-small">🕒 Présence</a><a href="/paie/${s.id}" class="btn-small btn-green">💵 Paie</a><a href="/nouveau-acompte/${s.id}" class="btn-small">Acompte</a></td></tr>`;
    });
    res.send(html + `</table></div></div></body></html>`);
  });
});

app.get("/ajouter-employe", (req, res) =>
  res.send(
    `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Nouvel Employé</h1><div class="card"><form action="/sauver-employe" method="POST"><input type="text" name="nom" required placeholder="Nom"><input type="number" step="0.01" name="taux" required placeholder="Taux horaire (€)"><br><br><button type="submit" class="btn">Enregistrer</button></form></div></div></body></html>`,
  ),
);
app.post("/sauver-employe", (req, res) =>
  db.run(
    `INSERT INTO Personnel (nom, taux_horaire) VALUES (?,?)`,
    [req.body.nom, req.body.taux],
    () => res.redirect("/personnel"),
  ),
);

// POINTAGE
app.get("/pointage/:id", (req, res) => {
  db.get(`SELECT nom FROM Personnel WHERE id=?`, [req.params.id], (e, p) => {
    db.all(
      `SELECT * FROM Pointages WHERE personnel_id=? ORDER BY id DESC`,
      [req.params.id],
      (e, rows) => {
        let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("perso")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Présence : ${p.nom}</h1><a href="/personnel" class="btn btn-grey">Retour</a></div>
            <div class="card"><form action="/sauver-pointage" method="POST" style="display:flex; gap:10px; align-items:flex-end;">
            <input type="hidden" name="pid" value="${req.params.id}">
            <div><label>Date</label><input type="date" name="date" required value="${new Date().toISOString().split("T")[0]}"></div>
            <div><label>Entrée</label><input type="time" name="entree" required></div>
            <div><label>Sortie</label><input type="time" name="sortie" required></div>
            <button type="submit" class="btn" style="margin-bottom:8px;">Pointer</button></form></div>
            <div class="card"><h3>Historique de pointage</h3><table><tr><th>Date</th><th>Entrée</th><th>Sortie</th><th>Total (h)</th></tr>`;
        rows.forEach(
          (r) =>
            (h += `<tr><td>${r.date}</td><td>${r.heure_entree}</td><td>${r.heure_sortie}</td><td><b>${r.total_heures.toFixed(2)} h</b></td></tr>`),
        );
        res.send(h + `</table></div></div></body></html>`);
      },
    );
  });
});

app.post("/sauver-pointage", (req, res) => {
  let [hE, mE] = req.body.entree.split(":").map(Number);
  let [hS, mS] = req.body.sortie.split(":").map(Number);
  let total = hS + mS / 60 - (hE + mE / 60);
  if (total < 0) total += 24;
  db.run(
    `INSERT INTO Pointages (personnel_id, date, heure_entree, heure_sortie, total_heures) VALUES (?,?,?,?,?)`,
    [req.body.pid, req.body.date, req.body.entree, req.body.sortie, total],
    () => res.redirect(`/pointage/${req.body.pid}`),
  );
});

// ACOMPTES
app.get("/nouveau-acompte/:id", (req, res) => {
  db.get(`SELECT nom FROM Personnel WHERE id=?`, [req.params.id], (e, p) => {
    res.send(
      `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Acompte : ${p.nom}</h1><div class="card"><form action="/sauver-acompte" method="POST"><input type="hidden" name="pid" value="${req.params.id}"><label>Montant (€)</label><input type="number" step="0.01" name="mt" required><br><br><button type="submit" class="btn">Valider</button><a href="/personnel" class="btn btn-grey" style="margin-left:10px;">Annuler</a></form></div></div></body></html>`,
    );
  });
});
app.post("/sauver-acompte", (req, res) =>
  db.run(
    `INSERT INTO Avances (personnel_id, montant, date) VALUES (?,?,?)`,
    [req.body.pid, req.body.mt, new Date().toLocaleDateString("fr-FR")],
    () => res.redirect("/personnel"),
  ),
);

// GESTION DE LA PAIE
app.get("/paie/:id", (req, res) => {
  db.get(`SELECT * FROM Personnel WHERE id=?`, [req.params.id], (e, emp) => {
    db.get(
      `SELECT IFNULL(SUM(total_heures), 0) as th FROM Pointages WHERE personnel_id=?`,
      [emp.id],
      (e, p) => {
        db.get(
          `SELECT IFNULL(SUM(montant), 0) as ta FROM Avances WHERE personnel_id=?`,
          [emp.id],
          (e, a) => {
            const brut = p.th * emp.taux_horaire;
            const net = brut - a.ta;
            res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("perso")}<div class="content" style="max-width:600px;margin:auto;">
                <h1>Fiche Récap : ${emp.nom}</h1>
                <div class="card">
                    <table style="font-size:16px;">
                        <tr><td>Taux Horaire :</td><td style="text-align:right"><b>${emp.taux_horaire} €/h</b></td></tr>
                        <tr><td>Heures Travaillées :</td><td style="text-align:right"><b>${p.th.toFixed(2)} h</b></td></tr>
                        <tr style="border-top: 2px solid #eee;"><td><b>Salaire Brut :</b></td><td style="text-align:right"><b>${brut.toFixed(2)} €</b></td></tr>
                        <tr><td>Acomptes versés :</td><td style="text-align:right; color:var(--red);">- ${a.ta.toFixed(2)} €</td></tr>
                        <tr style="border-top: 2px solid #000; font-size: 20px;"><td><b>NET À PAYER :</b></td><td style="text-align:right; color:var(--green);"><b>${net.toFixed(2)} €</b></td></tr>
                    </table>
                </div>
                <a href="/personnel" class="btn btn-grey">Retour Personnel</a>
                </div></body></html>`);
          },
        );
      },
    );
  });
});

// ========================================================
// 8. ACHATS & PRODUCTION (AVEC SÉCURITÉ STOCK)
// ========================================================
app.get("/achats", (req, res) => {
  db.all(
    `SELECT Achats.*, Fournisseurs.entreprise as fEnt FROM Achats LEFT JOIN Fournisseurs ON Achats.fournisseur_id = Fournisseurs.id ORDER BY Achats.id DESC`,
    (e, r) => {
      let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("ach")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Achats Matières</h1><a href="/ajouter-achat" class="btn">+ Nouvel Achat</a></div><div class="card"><table><tr><th>Date</th><th>Fournisseur</th><th>Total</th></tr>`;
      (r || []).forEach((a) => {
        h += `<tr><td>${a.date}</td><td>${a.fEnt}</td><td>${a.prix_total.toFixed(2)}€</td></tr>`;
      });
      res.send(h + `</table></div></div></body></html>`);
    },
  );
});

app.get("/ajouter-achat", (req, res) => {
  db.all(`SELECT id, entreprise FROM Fournisseurs`, (e, f) => {
    db.all(`SELECT id, nom FROM Stocks`, (e, m) => {
      let oF = f
        .map((x) => `<option value="${x.id}">${x.entreprise}</option>`)
        .join("");
      let oM = m
        .map((x) => `<option value="${x.id}">${x.nom}</option>`)
        .join("");
      res.send(
        `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Achat</h1><div class="card"><form action="/sauver-achat" method="POST"><label>Fournisseur</label><select name="fid">${oF}</select><label>Matière</label><select name="mid">${oM}</select><div class="grid-2"><div><label>Qté (kg)</label><input type="number" step="0.1" name="qte" required></div><div><label>Prix Unitaire (€)</label><input type="number" step="0.01" name="pu" required></div></div><br><button type="submit" class="btn" style="width:100%">Valider l'achat</button></form></div></div></body></html>`,
      );
    });
  });
});

app.post("/sauver-achat", (req, res) => {
  const tot = parseFloat(req.body.qte) * parseFloat(req.body.pu);
  db.run(
    `INSERT INTO Achats (fournisseur_id, stock_id, quantite, prix_unitaire, prix_total, date) VALUES (?,?,?,?,?,?)`,
    [
      req.body.fid,
      req.body.mid,
      req.body.qte,
      req.body.pu,
      tot,
      new Date().toLocaleDateString("fr-FR"),
    ],
    () => {
      db.run(
        `UPDATE Stocks SET quantite_kg = quantite_kg + ? WHERE id = ?`,
        [req.body.qte, req.body.mid],
        () => res.redirect("/achats"),
      );
    },
  );
});

app.get("/production", (req, res) => {
  db.all(
    `SELECT Production.*, Produits.nom as nomP FROM Production LEFT JOIN Produits ON Production.produit_id=Produits.id ORDER BY Production.id DESC`,
    (err, rows) => {
      let h = `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("fab")}<div class="content"><div style="display:flex;justify-content:space-between;margin-bottom:20px;"><h1>Production</h1><a href="/ajouter-production" class="btn">+ Déclarer Prod.</a></div><div class="card"><table><tr><th>Date</th><th>Produit</th><th>Qté</th></tr>`;
      (rows || []).forEach((p) => {
        h += `<tr><td>${p.date}</td><td>${p.nomP}</td><td>${p.quantite}</td></tr>`;
      });
      res.send(h + `</table></div></div></body></html>`);
    },
  );
});

app.get("/ajouter-production", (req, res) => {
  db.all(`SELECT id,nom FROM Personnel`, (e, s) => {
    db.all(`SELECT id,nom FROM Produits`, (e, p) => {
      db.all(`SELECT id,nom FROM Stocks`, (e, m) => {
        let oS = s
          .map((x) => `<option value="${x.id}">${x.nom}</option>`)
          .join("");
        let oP = p
          .map((x) => `<option value="${x.id}">${x.nom}</option>`)
          .join("");
        let oM = m
          .map((x) => `<option value="${x.id}">${x.nom}</option>`)
          .join("");
        res.send(
          `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:500px;margin:auto;"><h1>Production</h1><div class="card"><form action="/sauver-production" method="POST"><label>Employé</label><select name="oid">${oS}</select><label>Produit Fabriqué</label><select name="pid">${oP}</select><label>Matière puisée</label><select name="sid">${oM}</select><label>Qté produite</label><input type="number" name="qte" required><br><br><button type="submit" class="btn" style="width:100%">Valider</button></form></div></div></body></html>`,
        );
      });
    });
  });
});

app.post("/sauver-production", (req, res) => {
  db.get(
    `SELECT conso_matiere FROM Produits WHERE id=?`,
    [req.body.pid],
    (e, p) => {
      const ded = (p ? p.conso_matiere : 0) * req.body.qte;
      db.get(
        `SELECT quantite_kg, nom FROM Stocks WHERE id=?`,
        [req.body.sid],
        (e, stock) => {
          if (stock.quantite_kg < ded) {
            res.send(
              `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body><div class="content" style="max-width:600px;margin:auto;"><div class="card" style="text-align:center;"><h1 style="color:var(--red)">Erreur : Matière Insuffisante</h1><p style="font-size:16px;">Vous essayez de consommer <b>${ded.toFixed(2)} kg</b> de <b>${stock.nom}</b>.<br>Stock actuel : <b>${stock.quantite_kg.toFixed(2)} kg</b>.</p><br><br><a href="/ajouter-production" class="btn">Retour</a></div></div></body></html>`,
            );
          } else {
            db.run(
              `INSERT INTO Production (personnel_id,produit_id,stock_id,quantite,date) VALUES (?,?,?,?,?)`,
              [
                req.body.oid,
                req.body.pid,
                req.body.sid,
                req.body.qte,
                new Date().toLocaleDateString("fr-FR"),
              ],
              () => {
                db.run(
                  `UPDATE Stocks SET quantite_kg = quantite_kg - ? WHERE id = ?`,
                  [ded, req.body.sid],
                  () => res.redirect("/production"),
                );
              },
            );
          }
        },
      );
    },
  );
});

// ========================================================
// 9. PARAMÈTRES & DASHBOARD
// ========================================================
app.get("/parametres", (req, res) => {
  db.all(`SELECT * FROM Configuration`, (err, rows) => {
    let c = {};
    rows.forEach((r) => (c[r.cle] = r.valeur));
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("param")}<div class="content" style="max-width:800px;margin:auto;"><h1>Réglages de l'Entreprise</h1><div class="card"><form action="/sauver-parametres" method="POST">
        <h3>Coordonnées</h3><div class="grid-2"><div><label>Nom de l'Usine</label><input type="text" name="nom_usine" value="${c.nom_usine || ""}"></div><div><label>Téléphone</label><input type="text" name="tel_usine" value="${c.tel_usine || ""}"></div></div>
        <div class="grid-2"><div><label>Adresse</label><input type="text" name="adresse_usine" value="${c.adresse_usine || ""}"></div><div><label>Email</label><input type="text" name="email_usine" value="${c.email_usine || ""}"></div></div><hr style="margin:20px 0; border:0; border-top:1px solid #eee;">
        <h3>Charges Mensuelles (€)</h3><div class="grid-2"><div><label>Loyer</label><input type="number" name="loyer_mois" value="${c.loyer_mois || "0"}"></div><div><label>Électricité</label><input type="number" name="cout_elec_mois" value="${c.cout_elec_mois || "0"}"></div></div>
        <div class="grid-2"><div><label>Amortissement Machine</label><input type="number" name="amortissement_mois" value="${c.amortissement_mois || "0"}"></div><div><label>Charges Diverses</label><input type="number" name="charges_diverses_mois" value="${c.charges_diverses_mois || "0"}"></div></div><br><button type="submit" class="btn" style="width:100%">Enregistrer les Paramètres</button></form></div></div></body></html>`);
  });
});

app.post("/sauver-parametres", (req, res) => {
  for (let k in req.body) {
    db.run(`INSERT OR REPLACE INTO Configuration (cle, valeur) VALUES (?,?)`, [
      k,
      req.body[k],
    ]);
  }
  res.redirect("/parametres");
});

app.get("/", (req, res) => {
  db.get(
    `SELECT SUM(prix_ligne) as ca, (SELECT SUM(montant) FROM Paiements) as recu FROM Ventes`,
    (err, v) => {
      res.send(
        `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${menu("dash")}<div class="content"><h1>Bilan de l'Usine</h1><div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;"><div class="card"><h4>C.A Généré</h4><h2>${(v.ca || 0).toFixed(2)}€</h2></div><div class="card"><h4>Encaissé Total</h4><h2 style="color:var(--green)">${(v.recu || 0).toFixed(2)}€</h2></div><div class="card"><h4>Reste Client</h4><h2 style="color:var(--red)">${((v.ca || 0) - (v.recu || 0)).toFixed(2)}€</h2></div></div></div></body></html>`,
      );
    },
  );
});

app.listen(port, () =>
  console.log(
    `🚀 MASTER V45 - PAIE, POINTAGE & SYNTAXE CORRIGÉE : http://localhost:${port}`,
  ),
);
