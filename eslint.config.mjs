import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ["src/features/**/*.jsx", "src/features/**/*.js"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  /*
   * `no-undef` : le seul garde-fou contre « ce nom n'existe pas ».
   *
   * Il a manque deux fois en trois jours, et les deux fois l'ecran est parti en
   * production : `enterre` appele avant sa declaration (2026-09-06), puis
   * `setReste` survivant a un renommage d'etat, qui faisait qu'appuyer sur
   * « Enregistrer » dans la Room ne faisait RIEN - la fonction levait une
   * ReferenceError avant d'ouvrir la feuille. Ni `next build` ni les autres
   * regles ne voient ce genre de faute: le fichier est syntaxiquement valide.
   */
  {
    files: ["src/**/*.js", "src/**/*.jsx", "src/**/*.mjs"],
    rules: {
      "no-undef": "error",
    },
  },
  /*
   * `vibefx-layout` n'est plus une UI montee (voir AGENTS.md) : seuls ses
   * `themedTemplates` et ses deux CSS servent encore. Il contient un
   * `slotRectsState` qui n'existe nulle part - un vrai bug, mais dans du code
   * que personne n'execute. On le garde VISIBLE en avertissement plutot que de
   * reecrire a l'aveugle un composant mort, et sans faire echouer le gate.
   */
  {
    files: ["src/features/vibefx-layout/**/*.jsx", "src/features/vibefx-layout/**/*.js"],
    rules: {
      "no-undef": "warn",
    },
  },
  {
    files: ["src/features/vibefx-studio/**/*.jsx", "src/features/vibefx-studio/**/*.js"],
    rules: {
      "react/display-name": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
