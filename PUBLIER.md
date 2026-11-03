# Mettre EQUIPHARMA en ligne et sur le Play Store

L'application est un site web installable (PWA). Deux étapes : la mettre en
ligne gratuitement, puis l'emballer pour le Play Store.

## 1. Mettre l'application en ligne (gratuit, ~5 minutes)

Avec **GitHub Pages**, directement depuis ce dépôt :

1. Sur GitHub, ouvrez le dépôt → **Settings** → **Pages**.
2. *Source* : **Deploy from a branch**. *Branch* : **main**, dossier **/ (root)**.
   Cliquez **Save**.
3. Après une à deux minutes, l'appli est en ligne à l'adresse
   `https://djibret86.github.io/equipharma/`.

Ouvrez ce lien sur un téléphone Android avec Chrome : le menu propose
**« Installer l'application »**. Elle fonctionne ensuite hors-ligne.

## 2. Publier sur le Play Store

1. Créez un compte **Google Play Console** (frais unique de 25 $, carte
   bancaire, vérification d'identité).
2. Allez sur **https://www.pwabuilder.com**, collez l'adresse de l'appli
   (étape 1) et choisissez **Android**. L'outil génère le paquet à envoyer
   (`.aab`) et une **clé de signature** : gardez précieusement la clé et son
   mot de passe, ils servent à chaque mise à jour.
3. Placez le fichier `assetlinks.json` fourni par PWABuilder dans un dossier
   `.well-known/` du dépôt (il prouve que l'appli et le site vous
   appartiennent).
4. Dans la Play Console : créez l'application, remplissez la fiche (nom,
   description, captures, icône), la **politique de confidentialité** (l'appli
   ne collecte aucune donnée personnelle) et le questionnaire de contenu.
5. **Test fermé obligatoire** pour un compte personnel récent : au moins
   12 testeurs pendant 14 jours d'affilée (règle à vérifier dans la Play
   Console au moment venu). Ensuite, demandez la mise en production.

## Mettre à jour

- **Les données** : remplacez `data/medicaments.csv` sur GitHub et changez la
  date dans `data/meta.json`. L'appli installée récupère la nouvelle base à la
  prochaine ouverture avec connexion. Aucune nouvelle publication sur le Play
  Store n'est nécessaire.
- **Le code** : après une modification de `app.js`, `styles.css` ou
  `index.html`, augmentez le numéro dans `sw.js` (`equipharma-v1.0.0` →
  `equipharma-v1.0.1`) pour que les téléphones prennent la nouvelle version.
