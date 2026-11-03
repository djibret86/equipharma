# Données EQUIPHARMA

Le fichier [`medicaments.csv`](medicaments.csv) contient la base des médicaments
(encodage UTF-8, séparateur virgule).

## Dictionnaire des colonnes

| Colonne | Description |
| --- | --- |
| `DCI` | Dénomination Commune Internationale (la molécule) |
| `Nom_commercial` | Nom commercial du médicament |
| `Dosage` | Dosage (ex. `500mg`) |
| `Forme` | Forme galénique (ex. `CP` = comprimé) |
| `Conditionnement` | Conditionnement (ex. `B/10` = boîte de 10) |
| `Type` | `SPECIALITE DE REFERENCE` (marque) ou `EQUIVALENT` (générique) |
| `Etat` | Disponibilité (`DISPONIBLE`, `INDISPONIBLE`, `ARRET DE COMMERCIALISATION`, ou `DISPONIBILITE NON CONFIRMEE` — voir plus bas) |
| `Prix_FCFA` | Prix en FCFA (nombre ; vide si non renseigné) |
| `Prix_suspect` | `OUI` si le prix paraît aberrant (> 500 000 FCFA) et doit être vérifié |
| `EAN` | Code-barres (quand disponible) |
| `Classe` | Classe médicamenteuse |
| `Code_interne` | Identifiant interne hérité de la base d'origine |

## Qualité et limites

- Données issues de la base initiale de ~2013 → **prix et disponibilité à
  réactualiser**.
- Prix renseigné pour ~75 % des lignes ; codes-barres pour ~23 %.
- Les colonnes contre-indications et interactions de la base d'origine étaient
  vides et n'ont pas été reprises.
- Quelques prix aberrants sont signalés par la colonne `Prix_suspect`.
- Les codes d'état `S` (722 lignes) et `N` (192 lignes) de la base d'origine
  n'avaient pas de libellé et leur sens n'a pas pu être retrouvé : ces lignes
  sont marquées `DISPONIBILITE NON CONFIRMEE`. Elles n'ont presque jamais de
  prix ; les signalements de la communauté permettront de les compléter.
- Les noms se terminant par `CH` désignent des **conditionnements
  hospitaliers** (grandes boîtes). L'application les affiche mais ne les
  compare pas aux boîtes vendues au détail.
- Le `Conditionnement` (`B/30`, `10 BL/10`, `FL/60ml`…) sert à calculer un
  prix unitaire, pour comparer équitablement des boîtes de tailles différentes.

## Licence des données

Les données sont publiées sous **Open Database License (ODbL) v1.0** — voir
[`LICENSE-ODbL.txt`](LICENSE-ODbL.txt). En résumé : vous êtes libre de les
utiliser, partager et modifier, à condition de **créditer EQUIPHARMA** et de
**redistribuer toute base dérivée sous la même licence ouverte**.
