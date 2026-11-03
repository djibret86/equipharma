# EQUIPHARMA

**Une base de données ouverte des médicaments vendus en Côte d'Ivoire, reliant DCI (molécules), équivalents génériques et prix — pour faciliter l'accès aux médicaments.**

EQUIPHARMA permet de retrouver, à partir d'un médicament ou d'une molécule, ses
équivalents disponibles et de comparer leurs prix. L'objectif est simple :
**aider chacun à trouver un médicament équivalent moins cher.**

Ce dépôt contient la base de données et, à terme, l'application qui l'exploite.
Le projet est **ouvert et collaboratif** : tout le monde peut consulter,
corriger et enrichir les données.

---

## ⚠️ Avertissement

Les informations de ce projet sont fournies **à but documentaire uniquement**.
Elles **ne remplacent pas l'avis d'un pharmacien ou d'un médecin** et ne
constituent ni une prescription ni un conseil thérapeutique. Voir
[DISCLAIMER.md](DISCLAIMER.md).

Les données proviennent d'un travail initial de ~2013 et sont en cours de
réactualisation. **Ne vous fiez pas aux prix et à la disponibilité sans
vérification.**

---

## Ce que contient la base

- **~4 300 médicaments** reliés à **~900 molécules (DCI)**
- Distinction **spécialité de référence** / **équivalent générique**
- Prix (à réactualiser), forme, dosage, conditionnement, état de disponibilité
- Classes médicamenteuses

Le détail des colonnes est décrit dans [`data/README.md`](data/README.md).

## Structure du dépôt

```
equipharma/
├── index.html             ← l'application (page principale)
├── app.js                 ← logique : recherche, fiches, équivalents, signalement
├── styles.css             ← apparence (thème clair et sombre)
├── sw.js                  ← fonctionnement hors-ligne
├── manifest.webmanifest   ← installation sur téléphone
├── icons/                 ← icônes de l'application
├── README.md              ← ce fichier
├── LICENSE                ← licence du CODE (AGPL-3.0)
├── DISCLAIMER.md          ← avertissement santé
├── CONTRIBUTING.md        ← comment contribuer
├── CODE_OF_CONDUCT.md     ← règles de la communauté
├── data/
│   ├── medicaments.csv    ← la base de données
│   ├── meta.json          ← version et date des données
│   ├── README.md          ← dictionnaire des données
│   └── LICENSE-ODbL.txt   ← licence des DONNÉES (ODbL-1.0)
└── docs/
    ├── AUTHORSHIP.md      ← paternité et historique du projet
    └── PUBLIER.md         ← mettre l'appli en ligne et sur le Play Store
```

## L'application

L'application fonctionne entièrement dans le navigateur, **sans serveur** et
**hors-ligne** une fois ouverte. Elle s'installe sur un téléphone comme une
appli classique. Pour la mettre en ligne et la publier sur le Play Store, voir
[docs/PUBLIER.md](docs/PUBLIER.md).

**Mettre à jour les données** : remplacer `data/medicaments.csv` (et la date
dans `data/meta.json`) suffit. Aucune autre modification n'est nécessaire.

Les prix sont comparés **à dosage égal et au prix unitaire** (par comprimé,
gélule ou ml) quand la taille de la boîte est connue. Les boîtes hospitalières
sont affichées mais jamais proposées comme « le moins cher ».

## Licences

Ce projet sépare volontairement **le code** et **les données** :

- **Code** → [AGPL-3.0](LICENSE). Quiconque réutilise ou héberge ce code doit
  publier son propre code sous la même licence ouverte.
- **Données** → [ODbL-1.0](data/LICENSE-ODbL.txt). Vous pouvez les utiliser et
  les redistribuer, à condition de **créditer EQUIPHARMA** et de **garder
  ouvertes** les bases dérivées.

Ces choix protègent le caractère ouvert du projet : il peut être réutilisé,
mais pas refermé ni privatisé.

## Contribuer

Les corrections et ajouts sont bienvenus — un prix qui a changé, un médicament
manquant, une erreur d'équivalence. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Auteur et origine

Projet initié et conçu par **Djibret DAKOURI**. Voir l'historique et la
paternité dans [docs/AUTHORSHIP.md](docs/AUTHORSHIP.md).
